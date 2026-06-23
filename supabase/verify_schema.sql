-- ============================================================================
-- verify_schema.sql — post-migration verification for a FRESH Supabase project
-- ============================================================================
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run.
-- It is READ-ONLY (only SELECTs) and changes nothing.
--
-- It returns one row per check with a PASS/FAIL status, covering:
--   1. the 7 application tables
--   2. the customer_reliability_scores view
--   3. the delete_own_account() RPC (+ handle_new_user)
--   4. the on_auth_user_created signup trigger
--   5. RLS enabled on all 7 tables
--   (bonus) RLS policy count
--
-- Every row should read PASS. If any row is FAIL, re-apply the corresponding
-- migration from supabase/migrations/ (see MIGRATION_RUNBOOK.md).
-- ============================================================================

with
expected_tables(name) as (
  values ('user_profiles'), ('job_posts'), ('job_applications'),
         ('private_jobs'), ('reviews'), ('manual_income'), ('disputes')
),
t_count as (
  select count(*) n from information_schema.tables
  where table_schema = 'public'
    and table_name in (select name from expected_tables)
),
v_count as (
  select count(*) n from information_schema.views
  where table_schema = 'public' and table_name = 'customer_reliability_scores'
),
fn_delete as (
  select count(*) n from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public' and p.proname = 'delete_own_account'
),
fn_newuser as (
  select count(*) n from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public' and p.proname = 'handle_new_user'
),
trg as (
  select count(*) n from pg_trigger
  where tgname = 'on_auth_user_created' and not tgisinternal
),
rls_on as (
  select count(*) n from pg_class c
  join pg_namespace ns on ns.oid = c.relnamespace
  where ns.nspname = 'public'
    and c.relrowsecurity
    and c.relname in (select name from expected_tables)
),
pol as (
  select count(*) n from pg_policies
  where schemaname = 'public'
    and tablename in (select name from expected_tables)
),
-- Later migrations (20260614+) — the columns/tables that were missing from the
-- old apply_all_migrations.sql and broke job/invoice/expense saves.
col_hourly as (
  select count(*) n from information_schema.columns
  where table_schema = 'public' and table_name = 'private_jobs' and column_name = 'job_type'
),
col_progress as (
  select count(*) n from information_schema.columns
  where table_schema = 'public' and table_name = 'private_jobs' and column_name = 'progress_photos'
),
col_logo as (
  select count(*) n from information_schema.columns
  where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'logo_url'
),
tbl_expenses as (
  select count(*) n from information_schema.tables
  where table_schema = 'public' and table_name = 'expenses'
),
tbl_portfolio as (
  select count(*) n from information_schema.tables
  where table_schema = 'public' and table_name = 'portfolio_projects'
),
buckets as (
  select count(*) n from storage.buckets
  where id in ('job-photos', 'receipts', 'portfolio')
)
select * from (
  select 1 as ord,
         '1. Tables (expect 7)'                  as check_name,
         (select n from t_count)::text || ' / 7' as found,
         case when (select n from t_count) = 7 then 'PASS' else 'FAIL' end as status
  union all
  select 2,
         '2. View customer_reliability_scores',
         (select n from v_count)::text || ' / 1',
         case when (select n from v_count) = 1 then 'PASS' else 'FAIL' end
  union all
  select 3,
         '3. RPC delete_own_account()',
         (select n from fn_delete)::text || ' / 1',
         case when (select n from fn_delete) = 1 then 'PASS' else 'FAIL' end
  union all
  select 4,
         '3b. Fn handle_new_user()',
         (select n from fn_newuser)::text || ' / 1',
         case when (select n from fn_newuser) = 1 then 'PASS' else 'FAIL' end
  union all
  select 5,
         '4. Trigger on_auth_user_created',
         (select n from trg)::text || ' / 1',
         case when (select n from trg) = 1 then 'PASS' else 'FAIL' end
  union all
  select 6,
         '5. RLS enabled on all 7 tables',
         (select n from rls_on)::text || ' / 7',
         case when (select n from rls_on) = 7 then 'PASS' else 'FAIL' end
  union all
  select 7,
         '(bonus) RLS policies present',
         (select n from pol)::text || ' policies',
         case when (select n from pol) > 0 then 'PASS' else 'FAIL' end
  union all
  select 8,
         '6. private_jobs.job_type (hourly_jobs migration)',
         (select n from col_hourly)::text || ' / 1',
         case when (select n from col_hourly) = 1 then 'PASS' else 'FAIL — re-run apply_all_migrations.sql' end
  union all
  select 9,
         '7. private_jobs.progress_photos',
         (select n from col_progress)::text || ' / 1',
         case when (select n from col_progress) = 1 then 'PASS' else 'FAIL — re-run apply_all_migrations.sql' end
  union all
  select 10,
         '8. expenses table (Receipt Vault)',
         (select n from tbl_expenses)::text || ' / 1',
         case when (select n from tbl_expenses) = 1 then 'PASS' else 'FAIL — re-run apply_all_migrations.sql' end
  union all
  select 11,
         '9. portfolio_projects table',
         (select n from tbl_portfolio)::text || ' / 1',
         case when (select n from tbl_portfolio) = 1 then 'PASS' else 'FAIL — re-run apply_all_migrations.sql' end
  union all
  select 12,
         '10. user_profiles.logo_url (branding)',
         (select n from col_logo)::text || ' / 1',
         case when (select n from col_logo) = 1 then 'PASS' else 'FAIL — re-run apply_all_migrations.sql' end
  union all
  select 13,
         '11. storage buckets (job-photos/receipts/portfolio)',
         (select n from buckets)::text || ' / 3',
         case when (select n from buckets) = 3 then 'PASS' else 'FAIL — re-run apply_all_migrations.sql' end
) s
order by ord;

-- ── Optional detail views (uncomment to inspect) ──────────────────────────
-- select table_name from information_schema.tables
--   where table_schema='public' order by table_name;
-- select tablename, policyname, cmd from pg_policies
--   where schemaname='public' order by tablename, policyname;
