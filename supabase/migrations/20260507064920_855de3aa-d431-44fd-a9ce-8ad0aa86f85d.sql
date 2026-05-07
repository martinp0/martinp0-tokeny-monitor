
CREATE TABLE public.shared_dashboards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  share_token TEXT NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  filters JSONB DEFAULT '{}'::jsonb,
  label TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(share_token)
);

ALTER TABLE public.shared_dashboards ENABLE ROW LEVEL SECURITY;

-- Authenticated users manage their own shares
CREATE POLICY "Users can manage own shared dashboards"
ON public.shared_dashboards
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Public read by share_token (for anonymous viewers)
CREATE POLICY "Anyone can read by share_token"
ON public.shared_dashboards
FOR SELECT
TO anon
USING (true);

CREATE INDEX idx_shared_dashboards_token ON public.shared_dashboards(share_token);
CREATE INDEX idx_shared_dashboards_user ON public.shared_dashboards(user_id);
