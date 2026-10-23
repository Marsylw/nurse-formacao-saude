-- A confirmed enrollment must reference both the learner account and an actual catalog course.
CREATE OR REPLACE FUNCTION public.admin_confirm_enrollment(p_inscricao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
  v_status text;
  v_user_id uuid;
  v_curso_id uuid;
BEGIN
  IF (auth.jwt() -> 'app_metadata' ->> 'role') IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Apenas administradores podem confirmar inscrições.' USING ERRCODE = '42501';
  END IF;
  IF p_inscricao_id IS NULL THEN
    RAISE EXCEPTION 'Indica uma inscrição válida.';
  END IF;

  UPDATE public.inscricoes AS i
  SET estado = 'confirmado'
  WHERE i.id = p_inscricao_id
    AND lower(btrim(coalesce(i.estado, ''))) = 'pendente'
    AND i.user_id IS NOT NULL
    AND i.curso_id IS NOT NULL
  RETURNING jsonb_build_object('id', i.id, 'estado', i.estado) INTO v_result;
  IF v_result IS NOT NULL THEN
    RETURN v_result;
  END IF;

  SELECT i.estado, i.user_id, i.curso_id
    INTO v_status, v_user_id, v_curso_id
  FROM public.inscricoes AS i
  WHERE i.id = p_inscricao_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inscrição não encontrada.' USING ERRCODE = 'P0002';
  END IF;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'A inscrição ainda não está associada a uma conta de aluno. O aluno deve iniciar sessão com o email da inscrição antes da confirmação.';
  END IF;
  IF v_curso_id IS NULL THEN
    RAISE EXCEPTION 'A inscrição não está associada a um curso válido do catálogo.';
  END IF;
  IF lower(btrim(coalesce(v_status, ''))) <> 'pendente' THEN
    RAISE EXCEPTION 'Só é possível confirmar inscrições pendentes.';
  END IF;
  RAISE EXCEPTION 'Não foi possível confirmar a inscrição.';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_confirm_enrollment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_confirm_enrollment(uuid) TO authenticated;
