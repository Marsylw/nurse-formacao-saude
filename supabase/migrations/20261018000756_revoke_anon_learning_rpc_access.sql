-- Quiz and admin learning RPCs are authenticated-only; their own role checks remain in place.
REVOKE EXECUTE ON FUNCTION public.admin_create_assessment(uuid,bigint,text,text,integer,jsonb,boolean,integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_assessments(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_student_assessments(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_student_assessment(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.submit_student_assessment(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_assessment(uuid,bigint,text,text,integer,jsonb,boolean,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_assessments(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_assessments(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_assessment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_student_assessment(uuid,jsonb) TO authenticated;
