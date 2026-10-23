-- Admin-only enrollment review and confirmation.
-- The list RPC deliberately excludes the legacy `senha` column.
CREATE OR REPLACE FUNCTION public.admin_list_enrollments(
  p_status text DEFAULT 'pendente',
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  curso_id uuid,
  nome_aluno text,
  telefone text,
  email text,
  mensagem text,
  estado text,
  criado_em timestamptz,
  curso_nome text,
  metodo_pagamento text,
  conta_vinculada boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (auth.jwt() -> 'app_metadata' ->> 'role') IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Apenas administradores podem consultar inscrições.' USING ERRCODE = '42501';
  END IF;
  IF p_limit NOT BETWEEN 1 AND 200 OR p_offset < 0 THEN
    RAISE EXCEPTION 'Parâmetros de paginação inválidos.';
  END IF;
  RETURN QUERY
  SELECT i.id, i.curso_id, i.nome, i.telefone, i.email, i.mensagem, i.estado,
         i.created_at, coalesce(c.nome, i.curso, 'Curso sem nome'), i.pagamento,
         i.user_id IS NOT NULL
  FROM public.inscricoes AS i
  LEFT JOIN public.cursos AS c ON c.id = i.curso_id
  WHERE p_status IS NULL OR lower(btrim(p_status)) = 'todos'
        OR lower(btrim(coalesce(i.estado, ''))) = lower(btrim(p_status))
  ORDER BY i.created_at DESC, i.id
  LIMIT p_limit OFFSET p_offset;
END;
$$;

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
  RETURNING jsonb_build_object('id', i.id, 'estado', i.estado) INTO v_result;

  IF v_result IS NOT NULL THEN
    RETURN v_result;
  END IF;

  SELECT i.estado, i.user_id INTO v_status, v_user_id
  FROM public.inscricoes AS i
  WHERE i.id = p_inscricao_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inscrição não encontrada.' USING ERRCODE = 'P0002';
  END IF;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'A inscrição ainda não está associada a uma conta de aluno. O aluno deve iniciar sessão com o email da inscrição antes da confirmação.';
  END IF;
  IF lower(btrim(coalesce(v_status, ''))) <> 'pendente' THEN
    RAISE EXCEPTION 'Só é possível confirmar inscrições pendentes.';
  END IF;
  RAISE EXCEPTION 'Não foi possível confirmar a inscrição.';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_enrollments(text,integer,integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_confirm_enrollment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_enrollments(text,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_confirm_enrollment(uuid) TO authenticated;
