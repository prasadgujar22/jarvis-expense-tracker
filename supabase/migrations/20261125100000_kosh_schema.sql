-- Kosh schema: per-user data with Row Level Security.
-- Client generates text ids; primary key is (user_id, id) so ids only need to be unique per user.

create or replace function public.kosh_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.categories (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  name text not null check (char_length(name) between 1 and 80),
  kind text not null check (kind in ('expense', 'income')),
  icon text not null default 'circle',
  color text not null default '#64748b',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.accounts (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  name text not null check (char_length(name) between 1 and 80),
  type text not null check (type in ('cash', 'bank', 'card', 'wallet')),
  opening_balance bigint not null default 0,
  color text not null default '#10b981',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.transactions (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  type text not null check (type in ('income', 'expense', 'transfer')),
  amount bigint not null check (amount > 0),
  category_id text,
  account_id text not null,
  to_account_id text,
  date date not null,
  payee text not null default '' check (char_length(payee) <= 200),
  note text not null default '' check (char_length(note) <= 2000),
  tags text[] not null default '{}',
  recurring_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index transactions_user_date_idx on public.transactions (user_id, date desc);

create table public.budgets (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  category_id text, -- null = overall monthly budget
  amount bigint not null check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.recurring_rules (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  title text not null check (char_length(title) between 1 and 120),
  type text not null check (type in ('income', 'expense')),
  amount bigint not null check (amount > 0),
  category_id text not null,
  account_id text not null,
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly', 'yearly')),
  "interval" integer not null default 1 check ("interval" between 1 and 365),
  start_date date not null,
  end_date date,
  auto_post boolean not null default false,
  is_subscription boolean not null default false,
  posted_through date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.goals (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  name text not null check (char_length(name) between 1 and 80),
  target bigint not null check (target > 0),
  target_date date,
  emoji text not null default '🎯',
  color text not null default '#10b981',
  contributions jsonb not null default '[]'::jsonb check (jsonb_typeof(contributions) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  currency text not null default 'INR' check (currency in ('INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD')),
  theme text not null default 'dark' check (theme in ('dark', 'light', 'system')),
  name text not null default '' check (char_length(name) <= 80),
  last_account_id text,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['categories','accounts','transactions','budgets','recurring_rules','goals','settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.kosh_touch_updated_at()', t || '_touch', t);
    execute format('create policy "Users read own %1$s" on public.%1$I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy "Users insert own %1$s" on public.%1$I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "Users update own %1$s" on public.%1$I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "Users delete own %1$s" on public.%1$I for delete to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;
