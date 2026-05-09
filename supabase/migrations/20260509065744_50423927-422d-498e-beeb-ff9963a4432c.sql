-- 1. Add og_image_path column
ALTER TABLE public.shared_dashboards
  ADD COLUMN IF NOT EXISTS og_image_path TEXT;

-- 2. Tighten RLS: drop unrestricted anon policy. Reads are routed through
-- the service-role edge function `get-shared-dashboard`, which validates the token.
DROP POLICY IF EXISTS "Anyone can read by share_token" ON public.shared_dashboards;

-- 3. Storage bucket for OG images (public-read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('og-images', 'og-images', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Storage policies on og-images
-- Public read
CREATE POLICY "OG images are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'og-images');

-- Authenticated users can upload to their own folder (path: <user_id>/<file>)
CREATE POLICY "Users can upload their own OG images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'og-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own OG images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'og-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own OG images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'og-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);