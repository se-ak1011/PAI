-- In-app messaging, gated to accepted jobs.
-- A conversation can ONLY exist between a customer (the job poster) and the
-- contractor they hired (an accepted job_application). No messaging strangers.
-- Idempotent: safe to run more than once.

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  job_post_id   uuid not null references public.job_posts(id)     on delete cascade,
  customer_id   uuid not null references public.user_profiles(id) on delete cascade,
  contractor_id uuid not null references public.user_profiles(id) on delete cascade,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  constraint conversations_unique_per_hire unique (job_post_id, contractor_id)
);

create index if not exists conversations_customer_idx   on public.conversations (customer_id, last_message_at desc);
create index if not exists conversations_contractor_idx on public.conversations (contractor_id, last_message_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.user_profiles(id) on delete cascade,
  body text not null check (length(btrim(body)) > 0),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);

-- Bump conversations.last_message_at whenever a message is added (definer so we
-- don't need an UPDATE policy on conversations).
create or replace function public.touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
     set last_message_at = new.created_at
   where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation();

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;

-- Conversations: visible to either participant. Creatable by either participant
-- ONLY when an accepted application links this customer + contractor on this job.
drop policy if exists conversations_select on public.conversations;
create policy conversations_select
  on public.conversations for select
  using (auth.uid() = customer_id or auth.uid() = contractor_id);

drop policy if exists conversations_insert on public.conversations;
create policy conversations_insert
  on public.conversations for insert
  with check (
    (auth.uid() = customer_id or auth.uid() = contractor_id)
    and exists (
      select 1
      from public.job_applications a
      join public.job_posts p on p.id = a.job_post_id
      where a.job_post_id   = conversations.job_post_id
        and a.contractor_id = conversations.contractor_id
        and a.status        = 'accepted'
        and p.client_id     = conversations.customer_id
    )
  );

-- Messages: readable/insertable by conversation participants only.
drop policy if exists messages_select on public.messages;
create policy messages_select
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.customer_id = auth.uid() or c.contractor_id = auth.uid())
    )
  );

drop policy if exists messages_insert on public.messages;
create policy messages_insert
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.customer_id = auth.uid() or c.contractor_id = auth.uid())
    )
  );

-- Allow a participant to mark messages read (set read_at).
drop policy if exists messages_update on public.messages;
create policy messages_update
  on public.messages for update
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.customer_id = auth.uid() or c.contractor_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.customer_id = auth.uid() or c.contractor_id = auth.uid())
    )
  );
