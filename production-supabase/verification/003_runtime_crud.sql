-- Run in SQL Editor AFTER 20_runtime_role.sql, with one real confirmed Auth user.
-- All data writes below roll back. PostgreSQL identity sequences may advance.
-- This checks SQL grants/triggers. The browser acceptance matrix is still required.
BEGIN;
DO $$
DECLARE account_id uuid; product_id uuid;
BEGIN
  SELECT id INTO account_id FROM public.user_accounts ORDER BY created_at LIMIT 1;
  IF account_id IS NULL THEN
    RAISE EXCEPTION 'First sign in through the deployed app to create an account, then rerun this test.';
  END IF;
  PERFORM set_config('marginflow.crud_account',account_id::text,true);
END $$;
SET LOCAL ROLE marginflow_runtime;
DO $$
DECLARE account_id uuid := current_setting('marginflow.crud_account')::uuid;
  record_id uuid; marker text := 'CRUD-'||gen_random_uuid()::text; found integer;
BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole)) THEN
    RAISE EXCEPTION 'CRUD check must use the restricted runtime role.';
  END IF;
  INSERT INTO public.products(user_id,display_id,sku,name,category,brand,current_cost_price,stock_quantity)
    VALUES(account_id,marker,marker,'Temporary verification','Other','Verification',10,2) RETURNING id INTO record_id;
  SELECT count(*) INTO found FROM public.products WHERE id=record_id AND user_id=account_id;
  IF found<>1 THEN RAISE EXCEPTION 'CREATE/READ failed'; END IF;
  UPDATE public.products SET name='Updated verification' WHERE id=record_id AND user_id=account_id;
  IF NOT EXISTS(SELECT 1 FROM public.products WHERE id=record_id AND name='Updated verification' AND user_id=account_id) THEN
    RAISE EXCEPTION 'UPDATE failed';
  END IF;
  DELETE FROM public.products WHERE id=record_id AND user_id=account_id;
  IF EXISTS(SELECT 1 FROM public.products WHERE id=record_id) THEN RAISE EXCEPTION 'DELETE failed'; END IF;
  INSERT INTO public.financial_audit_logs(display_id,user_id,entity_type,entity_id,field_name,old_value,new_value,modified_by,reason)
    VALUES(marker,account_id,'PRODUCT_COST',marker,'verification','0','1','Runtime check','Rollback-only verification');
  BEGIN
    UPDATE public.financial_audit_logs SET reason='must fail' WHERE user_id=account_id AND display_id=marker;
    RAISE EXCEPTION 'Audit mutation was unexpectedly permitted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  IF has_table_privilege(current_user,'public.products','TRUNCATE')
    OR has_table_privilege(current_user,(SELECT c.oid FROM pg_class c JOIN pg_namespace n
      ON n.oid=c.relnamespace WHERE n.nspname='auth' AND c.relname='users'),'SELECT')
    OR has_table_privilege('anon','public.products','SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
    OR has_table_privilege('authenticated','public.products','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') THEN
    RAISE EXCEPTION 'Unexpected runtime or browser privileges';
  END IF;
  RAISE NOTICE 'PASS: runtime CRUD, audit insert, audit mutation denial and browser privilege checks';
END $$;
ROLLBACK;
