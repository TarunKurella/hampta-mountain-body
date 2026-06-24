create table if not exists public.duel_profiles (
  player_id text primary key check (player_id in ('tarun', 'sudhanshu')),
  display_name text not null,
  role_title text not null,
  avatar_id text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.duels (
  code text primary key,
  name text not null,
  travel_start_date date not null,
  trek_start_date date not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_logs (
  duel_code text not null references public.duels(code) on delete cascade,
  player_id text not null references public.duel_profiles(player_id) on delete cascade,
  log_date date not null,
  payload jsonb not null,
  score integer not null default 0,
  status text not null default 'pending',
  updated_at timestamptz not null default now(),
  primary key (duel_code, player_id, log_date)
);

create table if not exists public.gear_logs (
  duel_code text not null references public.duels(code) on delete cascade,
  player_id text not null references public.duel_profiles(player_id) on delete cascade,
  item_id text not null,
  done boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (duel_code, player_id, item_id)
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  duel_code text not null references public.duels(code) on delete cascade,
  player_id text not null references public.duel_profiles(player_id) on delete cascade,
  subscription jsonb not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_preferences (
  duel_code text not null references public.duels(code) on delete cascade,
  player_id text not null references public.duel_profiles(player_id) on delete cascade,
  morning_enabled boolean not null default true,
  evening_enabled boolean not null default true,
  friend_cleared_enabled boolean not null default true,
  rivalry_enabled boolean not null default true,
  safety_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (duel_code, player_id)
);

insert into public.duel_profiles (player_id, display_name, role_title, avatar_id)
values
  ('tarun', 'Tarun', 'Engine Builder', 'tarun-badge'),
  ('sudhanshu', 'Sudhanshu', 'Trail Contender', 'sudhanshu-badge')
on conflict (player_id) do update set
  display_name = excluded.display_name,
  role_title = excluded.role_title,
  avatar_id = excluded.avatar_id,
  updated_at = now();

insert into public.duels (code, name, travel_start_date, trek_start_date)
values ('HAMPTA20', 'Hampta Duel', '2026-07-18', '2026-07-20')
on conflict (code) do update set
  name = excluded.name,
  travel_start_date = excluded.travel_start_date,
  trek_start_date = excluded.trek_start_date,
  updated_at = now();

alter table public.duel_profiles enable row level security;
alter table public.duels enable row level security;
alter table public.daily_logs enable row level security;
alter table public.gear_logs enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_preferences enable row level security;

create policy "public read fixed duel profiles" on public.duel_profiles
  for select using (true);

create policy "public read fixed duel" on public.duels
  for select using (code = 'HAMPTA20');

create policy "public read fixed duel daily logs" on public.daily_logs
  for select using (duel_code = 'HAMPTA20');

create policy "public read fixed duel gear logs" on public.gear_logs
  for select using (duel_code = 'HAMPTA20');

-- Writes should go through Edge Functions using the service role key.
-- Do not add public insert/update policies unless you accept trust-based client writes.
