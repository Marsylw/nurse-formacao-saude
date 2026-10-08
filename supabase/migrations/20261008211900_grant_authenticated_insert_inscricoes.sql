-- Permit authenticated users to submit their own pending enrollment requests.
-- Row-level security remains enabled and continues to enforce the INSERT policy.
GRANT INSERT ON TABLE public.inscricoes TO authenticated;
