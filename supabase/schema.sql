-- Run this once in the Supabase SQL editor.
--
-- The whole app state is a single versioned JSON document, so one row per user
-- is the entire schema. Adding a field to the app needs no migration here.

create table if not exists public.app_state (
  user_id    uuid primary key references auth.users on delete cascade,
  doc        jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

-- Row-level security is what actually protects the data: the anon key shipped
-- in the client can only ever reach the signed-in user's own row.
drop policy if exists "read own state" on public.app_state;
create policy "read own state" on public.app_state
  for select using (auth.uid() = user_id);

drop policy if exists "insert own state" on public.app_state;
create policy "insert own state" on public.app_state
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own state" on public.app_state;
create policy "update own state" on public.app_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete own state" on public.app_state;
create policy "delete own state" on public.app_state
  for delete using (auth.uid() = user_id);

-- Lets a second device pick up changes without a manual refresh.
do $$
begin
  alter publication supabase_realtime add table public.app_state;
exception
  when duplicate_object then null;
end
$$;
