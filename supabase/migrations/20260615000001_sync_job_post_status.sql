-- ============================================================================
-- Sync private_jobs.status -> job_posts.status (customer-visible progress)
-- ============================================================================
-- The contractor advances their private_jobs row through its lifecycle
-- (accepted -> in_progress -> contractor_marked_done -> invoiced -> paid), but
-- the customer's screen reads job_posts.status, which was only ever set to
-- 'in_progress' at acceptance and never moved again. RLS also forbids the
-- contractor (a non-owner of the job_post) from writing job_posts directly.
--
-- This SECURITY DEFINER trigger mirrors the private job's status onto the
-- originating job_posts row (via source_job_post_id) so the customer sees live
-- progress. Customer-friendly labels are applied in the app UI; the stored
-- canonical job_posts statuses remain: open | accepted | in_progress | invoiced
-- | completed.
-- ============================================================================

create or replace function public.sync_job_post_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.source_job_post_id is not null then
    update public.job_posts
       set status = case new.status
                      when 'accepted'               then 'accepted'
                      when 'in_progress'            then 'in_progress'
                      when 'contractor_marked_done' then 'in_progress'
                      when 'invoiced'               then 'invoiced'
                      when 'paid'                   then 'completed'
                      else status
                    end
     where id = new.source_job_post_id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_private_job_status_sync on public.private_jobs;
create trigger on_private_job_status_sync
  after insert or update of status on public.private_jobs
  for each row execute function public.sync_job_post_status();
