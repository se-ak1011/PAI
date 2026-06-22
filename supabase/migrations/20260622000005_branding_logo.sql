-- Branding: optional business logo for contractors, shown on quotes/invoices
-- and the public profile. Stored as a public URL (uploaded to the public
-- `portfolio` bucket). Idempotent.

alter table public.user_profiles
  add column if not exists logo_url text;
