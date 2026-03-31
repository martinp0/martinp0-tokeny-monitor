-- Enable extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create exchange rates cache table
CREATE TABLE public.exchange_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  currency_pair TEXT NOT NULL DEFAULT 'USD_CZK',
  rate NUMERIC NOT NULL,
  source_date TEXT,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(currency_pair)
);

-- Enable RLS
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

-- Public read (no auth needed for exchange rates)
CREATE POLICY "Public read exchange rates"
  ON public.exchange_rates FOR SELECT
  USING (true);

-- Only service role can write
CREATE POLICY "Service role write exchange rates"
  ON public.exchange_rates FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Insert default fallback rate
INSERT INTO public.exchange_rates (currency_pair, rate, source_date)
VALUES ('USD_CZK', 23.5, 'fallback')
ON CONFLICT (currency_pair) DO NOTHING;