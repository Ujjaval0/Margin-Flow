-- Safe, additive hardening for the currently audited legacy Supabase database.
-- RLS does NOT protect TRUNCATE, REFERENCES or TRIGGER privileges.
BEGIN;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notifications, public.webhook_events FROM PUBLIC, anon, authenticated;
COMMIT;
