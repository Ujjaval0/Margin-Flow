-- Durable complaints and private document upload resources. No client table grants.
BEGIN;
ALTER TYPE public.audit_entity_type_enum ADD VALUE IF NOT EXISTS 'COMPLAINT';
ALTER TABLE public.customer_complaints ADD COLUMN IF NOT EXISTS record_data jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.customer_complaints DROP CONSTRAINT IF EXISTS customer_complaints_display_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_complaints_owner_display ON public.customer_complaints(user_id,display_id);
UPDATE storage.buckets SET file_size_limit=10485760,
  allowed_mime_types=ARRAY['application/pdf','image/jpeg','image/png','image/webp','image/bmp','image/tiff','text/plain','text/csv',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']::text[],
  public=false WHERE id='marginflow-private-documents';
COMMIT;
