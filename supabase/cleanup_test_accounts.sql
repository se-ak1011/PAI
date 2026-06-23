-- ============================================================================
-- cleanup_test_accounts.sql — remove test / deleted accounts from the app
-- ============================================================================
-- Run in: Supabase Dashboard → SQL Editor → New query.
-- Use this when old test accounts still appear in the marketplace "Tradespeople"
-- list even though you think you deleted them.
--
-- Why they linger: the marketplace lists every user_profiles row with
-- account_type contractor/both and onboarding_complete = true. A profile only
-- disappears when its row is gone. Deleting a user from
-- Authentication → Users cascades and removes the profile automatically — but a
-- profile can be left behind if it was created/edited outside that flow.
--
-- ⚠️ This script DELETES data. Run step 1 first and read the list before deleting.
-- ============================================================================

-- 1) See everyone currently in the system (newest first). Note the emails/ids
--    of the test accounts you want gone.
select id, email, username, account_type, onboarding_complete, created_at
from public.user_profiles
order by created_at desc;

-- 2) Delete specific test accounts BY EMAIL.
--    Deleting from auth.users cascades to user_profiles and everything they own
--    (private_jobs, job_posts, job_applications, reviews, expenses, portfolio…).
--    >>> Edit the email list below, then remove the comment markers to run. <<<
-- delete from auth.users
-- where email in (
--   'test1@example.com',
--   'test2@example.com'
-- );

-- 3) Defensive cleanup: remove ORPHANED profiles — any user_profiles row whose
--    auth user no longer exists. The FK cascade normally prevents these, but this
--    clears any left behind so they stop showing in the marketplace. Safe to run.
delete from public.user_profiles p
where not exists (select 1 from auth.users u where u.id = p.id);

-- 4) Verify what's left.
select count(*) as remaining_profiles from public.user_profiles;
