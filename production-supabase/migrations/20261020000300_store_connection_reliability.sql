-- Additive upgrade: never resets merchant connections or financial records.
BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_connections_id_owner ON public.marketplace_connections(id,user_id);
CREATE TABLE IF NOT EXISTS public.integration_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_accounts(id),
  connection_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('ORDERS','RECONCILE','WEBHOOK')),
  dedupe_key text NOT NULL,
  status text NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED','PROCESSING','COMPLETED','FAILED','REAUTH_REQUIRED')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  encrypted_payload text,
  body_hash text,
  result jsonb,
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  locked_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(connection_id,kind,dedupe_key),
  FOREIGN KEY(connection_id,user_id) REFERENCES public.marketplace_connections(id,user_id)
);
CREATE INDEX IF NOT EXISTS integration_tasks_due ON public.integration_tasks(available_at) WHERE status='QUEUED';
CREATE INDEX IF NOT EXISTS integration_tasks_owner ON public.integration_tasks(user_id,connection_id);

CREATE TABLE IF NOT EXISTS public.provider_deferred_orders (
  user_id uuid NOT NULL REFERENCES public.user_accounts(id),
  connection_id text NOT NULL,
  source_id text NOT NULL,
  reason text NOT NULL,
  encrypted_payload text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(connection_id,source_id),
  FOREIGN KEY(connection_id,user_id) REFERENCES public.marketplace_connections(id,user_id)
);

ALTER TABLE public.integration_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_deferred_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.integration_tasks,public.provider_deferred_orders FROM PUBLIC,anon,authenticated;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='marginflow_runtime') THEN
    GRANT SELECT,INSERT,UPDATE,DELETE ON public.integration_tasks,public.provider_deferred_orders TO marginflow_runtime;
    DROP POLICY IF EXISTS marginflow_server ON public.integration_tasks;
    DROP POLICY IF EXISTS marginflow_server ON public.provider_deferred_orders;
    CREATE POLICY marginflow_server ON public.integration_tasks TO marginflow_runtime USING(true) WITH CHECK(true);
    CREATE POLICY marginflow_server ON public.provider_deferred_orders TO marginflow_runtime USING(true) WITH CHECK(true);
  END IF;
END $$;
COMMIT;
