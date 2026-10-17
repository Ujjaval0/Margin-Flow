# Private document storage

`migrations/20261017000300_private_documents_bucket.sql` creates a non-public bucket for financial and supplier documents. It intentionally adds no browser policies. The current application stores files through its own document-storage code; it does not yet use Supabase Storage, so this bucket is a target resource and the upload/download routes still need a reviewed server-side adapter before it can hold production files.

Use server-generated object paths that include the internal account UUID, then authorize each upload and download against the verified Supabase user and MarginFlow account. Keep object paths out of public URLs. Define delete/retention behavior together with the database row lifecycle and test signed downloads, cross-tenant denial, backup/restore, and cleanup in staging.
