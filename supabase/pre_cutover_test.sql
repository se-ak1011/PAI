-- ============================================================================
-- pre_cutover_test.sql — fresh-start functional test (run in Supabase SQL editor)
-- ============================================================================
-- Exercises the real backend flows against the NEW project and prints a
-- PASS / FAIL table. It:
--   • simulates two signups by inserting into auth.users (fires the
--     on_auth_user_created trigger -> user_profiles)
--   • runs onboarding update, post job, apply, accept -> private_jobs,
--     manual income, review, and checks the reliability view
--   • checks the unique constraints (duplicate apply / duplicate review)
--   • tests RLS by switching into the `authenticated` role with a JWT context
--   • tests delete_own_account() (RPC + cascade) as a disposable user
--
-- SAFE: creates only fixed test UUIDs, cleans them up at the start and end
-- (auth.users delete cascades to all dependent rows), and makes NO permanent
-- changes. Re-runnable. Each check is isolated so one failure can't abort the
-- rest — any unexpected error is reported as ERROR with its message.
--
-- HOW TO READ: every row should say PASS. Send the whole table back if anything
-- says FAIL or ERROR.
-- ============================================================================

drop table if exists _pai_test_results;
create temp table _pai_test_results (step text, status text, detail text);

do $$
declare
  a  uuid := '0a000000-0000-4000-8000-000000000001';  -- contractor
  b  uuid := '0b000000-0000-4000-8000-000000000002';  -- customer
  c  uuid := '0c000000-0000-4000-8000-000000000003';  -- disposable (delete test)
  jp uuid := '10000000-0000-4000-8000-000000000010';  -- job_post
  ja uuid := '20000000-0000-4000-8000-000000000020';  -- job_application
  pj uuid := '30000000-0000-4000-8000-000000000030';  -- private_job
  mi uuid := '40000000-0000-4000-8000-000000000040';  -- manual_income
  rv uuid := '50000000-0000-4000-8000-000000000050';  -- review
  n  int;
  num numeric;
begin
  -- ── pre-clean (idempotent) ───────────────────────────────────────────────
  delete from auth.users where id in (a, b, c);

  -- ── 1. signup -> trigger creates user_profiles ──────────────────────────
  begin
    insert into auth.users
      (instance_id, id, aud, role, email, email_confirmed_at,
       created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values
      ('00000000-0000-0000-0000-000000000000', a, 'authenticated', 'authenticated',
       'pai-test-a@example.com', now(), now(), now(),
       jsonb_build_object('provider','email','providers', jsonb_build_array('email')),
       jsonb_build_object('username','Test Contractor','account_type','contractor')),
      ('00000000-0000-0000-0000-000000000000', b, 'authenticated', 'authenticated',
       'pai-test-b@example.com', now(), now(), now(),
       jsonb_build_object('provider','email','providers', jsonb_build_array('email')),
       jsonb_build_object('username','Test Customer','account_type','customer'));

    if (select count(*) from public.user_profiles where id in (a,b)) = 2 then
      insert into _pai_test_results values
        ('1. signup trigger creates user_profiles','PASS',
         'username/account_type seeded from auth metadata');
    else
      insert into _pai_test_results values
        ('1. signup trigger creates user_profiles','FAIL','profile row(s) missing');
    end if;
  exception when others then
    insert into _pai_test_results values ('1. signup trigger creates user_profiles','ERROR',sqlerrm);
  end;

  -- ── 2. onboarding update ─────────────────────────────────────────────────
  begin
    update public.user_profiles
       set onboarding_complete = true, account_type = 'contractor', city = 'Leeds',
           postcode_area = 'LS1', trades = array['Plumbing'], hourly_rate_from = 180,
           tax_rate = 30, subscription_status = 'free_trial',
           trial_started_at = now(), trial_ends_at = now() + interval '14 days'
     where id = a;
    select onboarding_complete::int into n from public.user_profiles where id = a;
    insert into _pai_test_results values
      ('2. onboarding update', case when n = 1 then 'PASS' else 'FAIL' end, null);
  exception when others then
    insert into _pai_test_results values ('2. onboarding update','ERROR',sqlerrm);
  end;

  -- ── 3. post a job (customer B) ───────────────────────────────────────────
  begin
    insert into public.job_posts (id, client_id, title, description, trade, status, budget, city, postcode_area)
    values (jp, b, 'Fix leaking radiator', 'Upstairs bedroom radiator drips', 'Plumbing', 'open', 250, 'Leeds', 'LS1');
    insert into _pai_test_results values
      ('3. post job', case when exists(select 1 from public.job_posts where id=jp) then 'PASS' else 'FAIL' end, null);
  exception when others then
    insert into _pai_test_results values ('3. post job','ERROR',sqlerrm);
  end;

  -- ── 4. apply (contractor A) + unique constraint ──────────────────────────
  begin
    insert into public.job_applications (id, job_post_id, contractor_id, quote_amount, eta_days, message, status)
    values (ja, jp, a, 240, 2, 'Can do tomorrow', 'pending');
    insert into _pai_test_results values
      ('4a. apply (job_applications insert)',
       case when exists(select 1 from public.job_applications where id=ja) then 'PASS' else 'FAIL' end, null);
  exception when others then
    insert into _pai_test_results values ('4a. apply (job_applications insert)','ERROR',sqlerrm);
  end;

  begin  -- duplicate apply must be blocked by unique (job_post_id, contractor_id)
    insert into public.job_applications (job_post_id, contractor_id, quote_amount, status)
    values (jp, a, 999, 'pending');
    insert into _pai_test_results values
      ('4b. duplicate apply blocked (unique)','FAIL','duplicate was allowed');
  exception
    when unique_violation then
      insert into _pai_test_results values ('4b. duplicate apply blocked (unique)','PASS',null);
    when others then
      insert into _pai_test_results values ('4b. duplicate apply blocked (unique)','ERROR',sqlerrm);
  end;

  -- ── 5. accept quote -> statuses + private_jobs ──────────────────────────
  begin
    update public.job_applications set status='accepted' where id=ja;
    update public.job_posts set status='in_progress' where id=jp;
    insert into public.private_jobs
      (id, contractor_id, title, customer, description, status, total, labour, materials, vat,
       materials_items, receipts, source_job_post_id)
    values (pj, a, 'Fix leaking radiator', 'Test Customer', 'From accepted quote', 'accepted',
            240, 144, 96, 0, '[]'::jsonb, '{}', jp);
    insert into _pai_test_results values
      ('5. accept -> private_jobs created',
       case when exists(select 1 from public.private_jobs where id=pj and source_job_post_id=jp)
            then 'PASS' else 'FAIL' end, null);
  exception when others then
    insert into _pai_test_results values ('5. accept -> private_jobs created','ERROR',sqlerrm);
  end;

  -- ── 6. manual income ─────────────────────────────────────────────────────
  begin
    insert into public.manual_income
      (id, contractor_id, amount, date, customer_name, category, payment_status, tax_rate, tax_set_aside)
    values (mi, a, 1000, now()::date, 'Cash job', 'Plumbing', 'paid', 30, 300);
    insert into _pai_test_results values
      ('6. manual income insert',
       case when exists(select 1 from public.manual_income where id=mi) then 'PASS' else 'FAIL' end, null);
  exception when others then
    insert into _pai_test_results values ('6. manual income insert','ERROR',sqlerrm);
  end;

  -- ── 7. review (contractor A -> customer B) + unique constraint ──────────
  begin
    insert into public.reviews
      (id, author_id, subject_id, job_post_id, mode, rating, categories, tags, would_work_again, status)
    values (rv, a, b, jp, 'contractor_to_customer', 5,
            jsonb_build_object('communication',5,'payment_reliability',4,'project_preparedness',5,
                               'scope_stability',4,'respectful_behaviour',5),
            array['paid_on_time','clear_communication'], true, 'published');
    insert into _pai_test_results values
      ('7a. review insert',
       case when exists(select 1 from public.reviews where id=rv) then 'PASS' else 'FAIL' end, null);
  exception when others then
    insert into _pai_test_results values ('7a. review insert','ERROR',sqlerrm);
  end;

  begin  -- duplicate review blocked by unique (author, subject, job_post, mode)
    insert into public.reviews (author_id, subject_id, job_post_id, mode, rating, status)
    values (a, b, jp, 'contractor_to_customer', 1, 'published');
    insert into _pai_test_results values
      ('7b. duplicate review blocked (unique)','FAIL','duplicate was allowed');
  exception
    when unique_violation then
      insert into _pai_test_results values ('7b. duplicate review blocked (unique)','PASS',null);
    when others then
      insert into _pai_test_results values ('7b. duplicate review blocked (unique)','ERROR',sqlerrm);
  end;

  -- ── 8. customer_reliability_scores view aggregates the review ───────────
  begin
    select total_reviews, avg_overall_rating
      into n, num
      from public.customer_reliability_scores where customer_id = b;
    insert into _pai_test_results values
      ('8. reliability view aggregates review',
       case when n = 1 and num = 5 then 'PASS' else 'FAIL' end,
       format('total_reviews=%s avg_overall_rating=%s', n, num));
  exception when others then
    insert into _pai_test_results values ('8. reliability view aggregates review','ERROR',sqlerrm);
  end;

  -- ── 9. RLS: customer B cannot read contractor A's private_jobs ──────────
  begin
    perform set_config('request.jwt.claims',
              jsonb_build_object('sub', b::text, 'role','authenticated')::text, true);
    execute 'set local role authenticated';
    select count(*) into n from public.private_jobs;     -- under RLS as B
    execute 'reset role';
    insert into _pai_test_results values
      ('9. RLS: B cannot see A private_jobs',
       case when n = 0 then 'PASS' else 'FAIL' end, format('rows visible to B = %s', n));
  exception when others then
    begin execute 'reset role'; exception when others then null; end;
    insert into _pai_test_results values ('9. RLS: B cannot see A private_jobs','ERROR',sqlerrm);
  end;

  -- ── 10. RLS sanity: contractor A CAN read own private_jobs ──────────────
  begin
    perform set_config('request.jwt.claims',
              jsonb_build_object('sub', a::text, 'role','authenticated')::text, true);
    execute 'set local role authenticated';
    select count(*) into n from public.private_jobs;     -- under RLS as A
    execute 'reset role';
    insert into _pai_test_results values
      ('10. RLS: A sees own private_jobs',
       case when n >= 1 then 'PASS' else 'FAIL' end, format('rows visible to A = %s', n));
  exception when others then
    begin execute 'reset role'; exception when others then null; end;
    insert into _pai_test_results values ('10. RLS: A sees own private_jobs','ERROR',sqlerrm);
  end;

  -- ── 11. RLS: non-author cannot moderate a review (admin-only write) ─────
  begin
    perform set_config('request.jwt.claims',
              jsonb_build_object('sub', b::text, 'role','authenticated')::text, true);
    execute 'set local role authenticated';
    update public.reviews set status='removed' where id = rv;   -- B is not the author
    get diagnostics n = row_count;
    execute 'reset role';
    insert into _pai_test_results values
      ('11. RLS: non-author cannot remove review',
       case when n = 0 then 'PASS' else 'FAIL' end, format('rows updated by B = %s', n));
  exception when others then
    begin execute 'reset role'; exception when others then null; end;
    insert into _pai_test_results values ('11. RLS: non-author cannot remove review','ERROR',sqlerrm);
  end;

  -- ── 12. delete_own_account() RPC + cascade (disposable user C) ──────────
  begin
    insert into auth.users
      (instance_id, id, aud, role, email, email_confirmed_at, created_at, updated_at,
       raw_app_meta_data, raw_user_meta_data)
    values
      ('00000000-0000-0000-0000-000000000000', c, 'authenticated', 'authenticated',
       'pai-test-c@example.com', now(), now(), now(),
       jsonb_build_object('provider','email','providers', jsonb_build_array('email')),
       jsonb_build_object('username','Temp','account_type','contractor'));

    perform set_config('request.jwt.claims',
              jsonb_build_object('sub', c::text, 'role','authenticated')::text, true);
    execute 'set local role authenticated';
    perform public.delete_own_account();                 -- runs as C
    execute 'reset role';

    insert into _pai_test_results values
      ('12. delete_own_account() removes user + profile',
       case when not exists(select 1 from auth.users where id=c)
             and not exists(select 1 from public.user_profiles where id=c)
            then 'PASS' else 'FAIL' end, null);
  exception when others then
    begin execute 'reset role'; exception when others then null; end;
    insert into _pai_test_results values ('12. delete_own_account() removes user + profile','ERROR',sqlerrm);
  end;

  -- ── final cleanup (cascades remove all dependent test rows) ─────────────
  delete from auth.users where id in (a, b, c);
end $$;

-- Results
select step, status, detail from _pai_test_results order by step;
