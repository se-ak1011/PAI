-- Receipt Vault + Claimable Expenses (Tax Pot).
-- expenses table + RLS, plus storage policies for a PRIVATE `receipts` bucket.
-- Path convention: {auth.uid()}/{timestamp}.{ext}  (owner-scoped, like job-photos).
-- Idempotent: safe to run more than once.
-- NOTE: also create a PRIVATE storage bucket named `receipts` in the dashboard.

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.private_jobs(id) on delete set null,
  vendor text,
  amount numeric not null default 0,
  category text,            -- materials | tools | ppe | parking | fuel | clothing | subcontractor | other
  split text not null default 'business',  -- business | personal | mixed
  business_pct int,         -- 0-100, used when split = 'mixed'
  confidence numeric,       -- AI confidence 0-1 (null = manual entry)
  needs_review boolean not null default false,
  receipt_path text,        -- object path in the `receipts` bucket
  note text,
  spent_on date,
  created_at timestamptz not null default now()
);

alter table public.expenses enable row level security;

drop policy if exists "Expenses: owner all" on public.expenses;
create policy "Expenses: owner all"
  on public.expenses for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Storage policies for the private `receipts` bucket (owner-scoped).
drop policy if exists "Receipts: owner can upload" on storage.objects;
create policy "Receipts: owner can upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Receipts: owner can read" on storage.objects;
create policy "Receipts: owner can read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Receipts: owner can delete" on storage.objects;
create policy "Receipts: owner can delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
