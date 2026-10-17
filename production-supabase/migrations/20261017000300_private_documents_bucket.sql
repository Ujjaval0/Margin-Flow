-- Private object bucket for supplier bills, claims, invoices, and other staged
-- financial documents. This migration creates no client access policies.
-- Upload/download routes must authorize the Supabase Auth identity against the
-- MarginFlow account and object owner before using a server-side Storage client.

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'marginflow-private-documents',
  'marginflow-private-documents',
  FALSE,
  52428800,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = FALSE,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
