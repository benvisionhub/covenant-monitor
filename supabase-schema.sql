-- Covenant Monitor Database Schema
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS agreements (
  id SERIAL PRIMARY KEY,
  company_name TEXT NOT NULL,
  covenants JSONB NOT NULL DEFAULT '[]',
  facility_details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security (allow all for MVP)
ALTER TABLE agreements ENABLE ROW LEVEL SECURITY;

-- Allow all operations for MVP (no auth)
CREATE POLICY "Allow all" ON agreements FOR ALL USING (true) WITH CHECK (true);

-- Optional: Create updated_at trigger
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_agreements_modtime
  BEFORE UPDATE ON agreements
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();
