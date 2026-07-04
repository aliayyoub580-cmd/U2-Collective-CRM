-- U2 CRM Lead clinic fields migration
-- Run this in Supabase SQL Editor after the base migration/access fix.
--
-- This updates the leads table for the clinic-focused Lead form.

BEGIN;

ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS lead_id TEXT;
ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS client_clinic_name TEXT;
ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS clinic_website TEXT;
ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS clinic_linkedin TEXT;
ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS clinic_phone TEXT;
ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS clinic_email TEXT;
ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS practice_size TEXT;
ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS city TEXT;

UPDATE leads
SET lead_id = 'LEAD-' || LPAD(id::TEXT, 5, '0')
WHERE lead_id IS NULL OR BTRIM(lead_id) = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_lead_id_unique
ON leads(lead_id)
WHERE lead_id IS NOT NULL;

CREATE OR REPLACE FUNCTION set_lead_public_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lead_id IS NULL OR BTRIM(NEW.lead_id) = '' THEN
    NEW.lead_id := 'LEAD-' || LPAD(NEW.id::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_lead_public_id ON leads;
CREATE TRIGGER trg_set_lead_public_id
BEFORE INSERT ON leads
FOR EACH ROW
EXECUTE FUNCTION set_lead_public_id();

UPDATE leads
SET client_clinic_name = COALESCE(client_clinic_name, company_name)
WHERE client_clinic_name IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'linkedin'
  ) THEN
    UPDATE leads SET clinic_linkedin = COALESCE(clinic_linkedin, linkedin)
    WHERE clinic_linkedin IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'phone'
  ) THEN
    UPDATE leads SET clinic_phone = COALESCE(clinic_phone, phone)
    WHERE clinic_phone IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'email'
  ) THEN
    UPDATE leads SET clinic_email = COALESCE(clinic_email, email)
    WHERE clinic_email IS NULL;
  END IF;
END $$;

UPDATE leads
SET status = CASE status
  WHEN 'New Lead' THEN 'Not contract'
  WHEN 'Contacted' THEN 'Follow up'
  WHEN 'Meeting Scheduled' THEN 'Meeting scheduled'
  WHEN 'Proposal Sent' THEN 'Follow up'
  WHEN 'Negotiation' THEN 'Follow up'
  WHEN 'Won' THEN 'Contracted'
  WHEN 'Lost' THEN 'Not interested'
  ELSE status
END;

ALTER TABLE IF EXISTS leads ALTER COLUMN status SET DEFAULT 'Not contract';

ALTER TABLE IF EXISTS leads DROP COLUMN IF EXISTS contact_person;
ALTER TABLE IF EXISTS leads DROP COLUMN IF EXISTS email;
ALTER TABLE IF EXISTS leads DROP COLUMN IF EXISTS phone;
ALTER TABLE IF EXISTS leads DROP COLUMN IF EXISTS linkedin;
ALTER TABLE IF EXISTS leads DROP COLUMN IF EXISTS estimated_value;

COMMIT;
