-- ============================================================================
-- delete_own_account() (RPC)
-- ============================================================================
-- Called by AuthContext.deleteAccount() via supabase.rpc('delete_own_account').
-- Runs as SECURITY DEFINER so the anon/authenticated client can delete the
-- caller's own auth.users row. Deleting the auth user cascades to
-- public.user_profiles (and onward to that user's owned rows via their FKs).
-- ============================================================================

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Cascades to public.user_profiles (FK on delete cascade) and dependents.
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
