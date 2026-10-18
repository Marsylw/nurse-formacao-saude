-- Alison-inspired structure for Nurse: Course -> Module -> Topic -> Assessment.
-- The implementation uses Nurse branding and the existing private course-materials bucket.

CREATE TABLE IF NOT EXISTS public.topicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id uuid NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  modulo_id bigint NOT NULL REFERENCES public.modulos(id) ON DELETE CASCADE,
  titulo text NOT NULL CHECK (char_length(btrim(titulo)) BETWEEN 1 AND 180),
  resumo text NOT NULL DEFAULT '',
  conteudo text NOT NULL DEFAULT '',
  ordem integer NOT NULL DEFAULT 0 CHECK (ordem >= 0),
  publicado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, curso_id)
);

ALTER TABLE public.materiais
  ADD COLUMN IF NOT EXISTS topico_id uuid;

DO $$ BEGIN
  ALTER TABLE public.materiais
    ADD CONSTRAINT materiais_topico_curso_fkey
    FOREIGN KEY (topico_id, curso_id)
    REFERENCES public.topicos(id, curso_id)
    ON DELETE SET NULL (topico_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS topicos_course_module_order_idx
  ON public.topicos (curso_id, modulo_id, ordem, created_at);
CREATE INDEX IF NOT EXISTS materiais_topic_order_idx
  ON public.materiais (topico_id, ordem);

ALTER TABLE public.topicos ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.topicos TO authenticated;
CREATE POLICY admins_manage_topics ON public.topicos
  FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY confirmed_students_read_published_topics ON public.topicos
  FOR SELECT TO authenticated
  USING (
    publicado IS TRUE
    AND EXISTS (
      SELECT 1 FROM public.inscricoes i
      WHERE i.user_id = (SELECT auth.uid())
        AND i.curso_id = topicos.curso_id
        AND lower(btrim(i.estado)) = 'confirmado'
    )
  );

CREATE TABLE IF NOT EXISTS public.avaliacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id uuid NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  modulo_id bigint REFERENCES public.modulos(id) ON DELETE CASCADE,
  titulo text NOT NULL CHECK (char_length(btrim(titulo)) BETWEEN 1 AND 180),
  descricao text NOT NULL DEFAULT '',
  minimo_percentual integer NOT NULL DEFAULT 80 CHECK (minimo_percentual BETWEEN 1 AND 100),
  questoes jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(questoes) = 'array'),
  publicado boolean NOT NULL DEFAULT false,
  ordem integer NOT NULL DEFAULT 0 CHECK (ordem >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS avaliacoes_course_module_order_idx
  ON public.avaliacoes (curso_id, modulo_id, ordem, created_at);
ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;
-- Student clients must use the RPCs, which never return answer keys.
REVOKE ALL ON public.avaliacoes FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.tentativas_avaliacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avaliacao_id uuid NOT NULL REFERENCES public.avaliacoes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  percentual integer NOT NULL CHECK (percentual BETWEEN 0 AND 100),
  aprovado boolean NOT NULL,
  respostas jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tentativas_avaliacao_user_idx
  ON public.tentativas_avaliacao (user_id, avaliacao_id, created_at DESC);
ALTER TABLE public.tentativas_avaliacao ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.tentativas_avaliacao TO authenticated;
CREATE POLICY students_read_own_assessment_attempts ON public.tentativas_avaliacao
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY admins_read_assessment_attempts ON public.tentativas_avaliacao
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
REVOKE INSERT, UPDATE, DELETE ON public.tentativas_avaliacao FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_create_assessment(
  p_curso_id uuid,
  p_modulo_id bigint,
  p_titulo text,
  p_descricao text,
  p_minimo_percentual integer,
  p_questoes jsonb,
  p_publicado boolean DEFAULT true,
  p_ordem integer DEFAULT 0
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_id uuid;
  v_question jsonb;
  v_options jsonb;
  v_correct integer;
BEGIN
  IF (auth.jwt() -> 'app_metadata' ->> 'role') IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Apenas administradores podem criar avaliações.' USING ERRCODE = '42501';
  END IF;
  IF p_curso_id IS NULL OR btrim(coalesce(p_titulo, '')) = '' THEN
    RAISE EXCEPTION 'Curso e título da avaliação são obrigatórios.';
  END IF;
  IF p_minimo_percentual NOT BETWEEN 1 AND 100 OR p_ordem < 0 THEN
    RAISE EXCEPTION 'Pontuação mínima ou ordem inválida.';
  END IF;
  IF p_modulo_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.modulos m WHERE m.id = p_modulo_id AND m.curso_id = p_curso_id
  ) THEN
    RAISE EXCEPTION 'O módulo selecionado não pertence ao curso.';
  END IF;
  IF jsonb_typeof(p_questoes) <> 'array' OR jsonb_array_length(p_questoes) < 1 THEN
    RAISE EXCEPTION 'Adiciona pelo menos uma pergunta.';
  END IF;
  FOR v_question IN SELECT value FROM jsonb_array_elements(p_questoes) LOOP
    IF btrim(coalesce(v_question ->> 'prompt', '')) = '' THEN
      RAISE EXCEPTION 'Cada pergunta precisa de um enunciado.';
    END IF;
    v_options := v_question -> 'options';
    IF jsonb_typeof(v_options) <> 'array' OR jsonb_array_length(v_options) < 2 THEN
      RAISE EXCEPTION 'Cada pergunta precisa de pelo menos duas opções.';
    END IF;
    SELECT count(*) INTO v_correct
      FROM jsonb_array_elements(v_options) o
      WHERE (o ->> 'correct')::boolean IS TRUE;
    IF v_correct <> 1 THEN
      RAISE EXCEPTION 'Cada pergunta precisa de exatamente uma resposta correta.';
    END IF;
  END LOOP;
  INSERT INTO public.avaliacoes (curso_id, modulo_id, titulo, descricao, minimo_percentual, questoes, publicado, ordem)
  VALUES (p_curso_id, p_modulo_id, btrim(p_titulo), coalesce(p_descricao, ''), p_minimo_percentual, p_questoes, coalesce(p_publicado, true), p_ordem)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_assessments(p_curso_id uuid)
RETURNS TABLE(id uuid, curso_id uuid, modulo_id bigint, titulo text, descricao text, minimo_percentual integer, pergunta_count integer, publicado boolean, ordem integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF (auth.jwt() -> 'app_metadata' ->> 'role') IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Apenas administradores podem consultar avaliações.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT a.id, a.curso_id, a.modulo_id, a.titulo, a.descricao, a.minimo_percentual,
    jsonb_array_length(a.questoes), a.publicado, a.ordem
  FROM public.avaliacoes a
  WHERE a.curso_id = p_curso_id
  ORDER BY a.ordem, a.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_student_assessments(p_curso_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.inscricoes i WHERE i.user_id = auth.uid()
      AND i.curso_id = p_curso_id AND lower(btrim(i.estado)) = 'confirmado'
  ) THEN
    RAISE EXCEPTION 'É necessária uma inscrição confirmada para consultar as avaliações.' USING ERRCODE = '42501';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'curso_id', a.curso_id, 'modulo_id', a.modulo_id,
    'titulo', a.titulo, 'descricao', a.descricao, 'minimo_percentual', a.minimo_percentual,
    'ordem', a.ordem, 'pergunta_count', jsonb_array_length(a.questoes)
  ) ORDER BY a.ordem, a.created_at), '[]'::jsonb)
  INTO v_result FROM public.avaliacoes a
  WHERE a.curso_id = p_curso_id AND a.publicado IS TRUE;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_student_assessment(p_assessment_id uuid)
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object(
    'id', a.id, 'titulo', a.titulo, 'descricao', a.descricao,
    'minimo_percentual', a.minimo_percentual,
    'questoes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', q.value ->> 'id', 'prompt', q.value ->> 'prompt',
        'options', (SELECT jsonb_agg(jsonb_build_object('id', o.value ->> 'id', 'text', o.value ->> 'text') ORDER BY o.ordinality)
                    FROM jsonb_array_elements(q.value -> 'options') WITH ORDINALITY o(value, ordinality))
      ) ORDER BY q.ordinality)
      FROM jsonb_array_elements(a.questoes) WITH ORDINALITY q(value, ordinality)
    ), '[]'::jsonb)
  )
  FROM public.avaliacoes a
  WHERE a.id = p_assessment_id AND a.publicado IS TRUE
    AND EXISTS (SELECT 1 FROM public.inscricoes i
      WHERE i.user_id = auth.uid() AND i.curso_id = a.curso_id AND lower(btrim(i.estado)) = 'confirmado')
$$;

CREATE OR REPLACE FUNCTION public.submit_student_assessment(p_assessment_id uuid, p_answers jsonb)
RETURNS TABLE(percentual integer, aprovado boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_assessment public.avaliacoes%ROWTYPE;
  v_question jsonb;
  v_total integer := 0;
  v_correct integer := 0;
  v_selected text;
  v_is_correct boolean;
  v_percent integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'É necessário iniciar sessão.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_assessment FROM public.avaliacoes WHERE id = p_assessment_id AND publicado IS TRUE;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.inscricoes i WHERE i.user_id = auth.uid()
      AND i.curso_id = v_assessment.curso_id AND lower(btrim(i.estado)) = 'confirmado'
  ) THEN RAISE EXCEPTION 'Avaliação não encontrada ou acesso não autorizado.' USING ERRCODE = '42501'; END IF;
  IF jsonb_typeof(p_answers) <> 'array' OR jsonb_array_length(p_answers) <> jsonb_array_length(v_assessment.questoes) THEN
    RAISE EXCEPTION 'Responde a todas as perguntas antes de submeter.';
  END IF;
  IF (SELECT count(DISTINCT x.value ->> 'question_id') FROM jsonb_array_elements(p_answers) x)
     <> jsonb_array_length(v_assessment.questoes) THEN
    RAISE EXCEPTION 'Há respostas repetidas ou inválidas.';
  END IF;
  FOR v_question IN SELECT value FROM jsonb_array_elements(v_assessment.questoes) LOOP
    v_total := v_total + 1;
    SELECT x.value ->> 'option_id' INTO v_selected FROM jsonb_array_elements(p_answers) x
      WHERE x.value ->> 'question_id' = v_question ->> 'id' LIMIT 1;
    IF v_selected IS NULL OR NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_question -> 'options') o
      WHERE o.value ->> 'id' = v_selected
    ) THEN RAISE EXCEPTION 'Uma das respostas não é válida.'; END IF;
    SELECT coalesce((o.value ->> 'correct')::boolean, false) INTO v_is_correct
      FROM jsonb_array_elements(v_question -> 'options') o WHERE o.value ->> 'id' = v_selected;
    IF v_is_correct THEN v_correct := v_correct + 1; END IF;
  END LOOP;
  v_percent := floor((v_correct::numeric / v_total) * 100)::integer;
  INSERT INTO public.tentativas_avaliacao (avaliacao_id,user_id,percentual,aprovado,respostas)
  VALUES (v_assessment.id,auth.uid(),v_percent,v_percent >= v_assessment.minimo_percentual,p_answers);
  RETURN QUERY SELECT v_percent, v_percent >= v_assessment.minimo_percentual;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_assessment(uuid,bigint,text,text,integer,jsonb,boolean,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_assessments(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_assessments(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_assessment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_student_assessment(uuid,jsonb) TO authenticated;
