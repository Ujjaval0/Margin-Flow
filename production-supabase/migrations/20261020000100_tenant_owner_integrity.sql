-- Complete UUID ownership introduced by the canonical books migration.
-- Invalid/unowned records cause a rollback; ownership is never guessed.
BEGIN;
DO $$
DECLARE t text; invalid_count bigint;
BEGIN
  FOREACH t IN ARRAY ARRAY['purchase_bills','supplier_payments','return_records','claims',
    'financial_commands','provider_financial_events','financial_audit_logs','customer_complaints'] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I r WHERE r.user_id IS NULL OR NOT EXISTS
      (SELECT 1 FROM public.user_accounts a WHERE a.id::text=r.user_id::text)', t) INTO invalid_count;
    IF invalid_count > 0 THEN
      RAISE EXCEPTION '% has % records without a valid account owner. Reconcile ownership before migrating.', t, invalid_count;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name=t AND column_name='user_id' AND data_type <> 'uuid') THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN user_id TYPE uuid USING user_id::uuid', t);
    END IF;
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN user_id SET NOT NULL', t);
    IF NOT EXISTS (SELECT 1 FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey)
      WHERE c.conrelid=format('public.%I',t)::regclass AND c.contype='f'
        AND a.attname='user_id' AND c.confrelid='public.user_accounts'::regclass) THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY(user_id)
        REFERENCES public.user_accounts(id) ON DELETE CASCADE', t, t||'_account_owner_fk');
    END IF;
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(user_id)', t||'_account_owner_idx', t);
  END LOOP;
END $$;
COMMIT;
