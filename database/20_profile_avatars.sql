-- Supabase-only: persistent, public profile avatars with owner-only writes.
-- Apply after migrations 01-19 on an existing Supabase project.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-avatars',
  'profile-avatars',
  TRUE,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "profile avatar owner insert" ON storage.objects;
CREATE POLICY "profile avatar owner insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'profile-avatars'
  AND name = auth.uid()::text || '/avatar'
);

DROP POLICY IF EXISTS "profile avatar owner update" ON storage.objects;
CREATE POLICY "profile avatar owner update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'profile-avatars'
  AND name = auth.uid()::text || '/avatar'
)
WITH CHECK (
  bucket_id = 'profile-avatars'
  AND name = auth.uid()::text || '/avatar'
);

DROP POLICY IF EXISTS "profile avatar owner delete" ON storage.objects;
CREATE POLICY "profile avatar owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'profile-avatars'
  AND name = auth.uid()::text || '/avatar'
);
