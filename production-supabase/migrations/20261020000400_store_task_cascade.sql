-- Preserve the account/connection deletion behavior of the existing marketplace vault.
BEGIN;
ALTER TABLE public.integration_tasks
  DROP CONSTRAINT integration_tasks_user_id_fkey,
  ADD CONSTRAINT integration_tasks_user_id_fkey FOREIGN KEY(user_id) REFERENCES public.user_accounts(id) ON DELETE CASCADE,
  DROP CONSTRAINT integration_tasks_connection_id_user_id_fkey,
  ADD CONSTRAINT integration_tasks_connection_id_user_id_fkey FOREIGN KEY(connection_id,user_id) REFERENCES public.marketplace_connections(id,user_id) ON DELETE CASCADE;
ALTER TABLE public.provider_deferred_orders
  DROP CONSTRAINT provider_deferred_orders_user_id_fkey,
  ADD CONSTRAINT provider_deferred_orders_user_id_fkey FOREIGN KEY(user_id) REFERENCES public.user_accounts(id) ON DELETE CASCADE,
  DROP CONSTRAINT provider_deferred_orders_connection_id_user_id_fkey,
  ADD CONSTRAINT provider_deferred_orders_connection_id_user_id_fkey FOREIGN KEY(connection_id,user_id) REFERENCES public.marketplace_connections(id,user_id) ON DELETE CASCADE;
COMMIT;
