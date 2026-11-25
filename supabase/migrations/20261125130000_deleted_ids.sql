-- Tombstones for deleted rows whose ids are deterministic (auto-posted recurring transactions: rec:<ruleId>:<date>).
-- A device with a stale cache may try to auto-post an occurrence the user already deleted elsewhere; the client checks
-- this table before inserting and skips tombstoned ids. Re-creating a row on purpose (undo) removes its tombstone.

create table public.deleted_ids (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  table_name text not null check (table_name in ('categories', 'accounts', 'transactions', 'budgets', 'recurring_rules', 'goals')),
  id text not null check (char_length(id) between 1 and 64),
  deleted_at timestamptz not null default now(),
  primary key (user_id, table_name, id)
);

alter table public.deleted_ids enable row level security;

create policy "Users read own deleted_ids" on public.deleted_ids for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert own deleted_ids" on public.deleted_ids for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own deleted_ids" on public.deleted_ids for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own deleted_ids" on public.deleted_ids for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.deleted_ids from anon;
grant select, insert, update, delete on public.deleted_ids to authenticated;
