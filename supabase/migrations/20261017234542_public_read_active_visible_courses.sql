-- Allow visitors to read only courses explicitly marked active and visible.
-- Course writes and changes remain protected by the existing admin RLS policy.
GRANT SELECT ON TABLE public.cursos TO anon;

CREATE POLICY public_can_view_active_visible_courses
ON public.cursos
FOR SELECT
TO anon
USING (ativo IS TRUE AND visivel IS TRUE);
