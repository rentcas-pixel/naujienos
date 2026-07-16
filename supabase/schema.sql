-- Paleisk Supabase SQL Editor’iuje (vieną kartą).

create table if not exists public.publish_gate (
  id int primary key default 1 check (id = 1),
  initialized boolean not null default false,
  legacy_slugs text[] not null default '{}',
  updated_at timestamptz not null default now()
);

insert into public.publish_gate (id, initialized, legacy_slugs)
values (1, false, '{}')
on conflict (id) do nothing;

create table if not exists public.topic_angle_packs (
  slug text primary key,
  status text not null check (status in ('ready', 'skipped')),
  pack jsonb,
  skip_reason text,
  generated_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists topic_angle_packs_status_idx
  on public.topic_angle_packs (status);

alter table public.publish_gate enable row level security;
alter table public.topic_angle_packs enable row level security;

-- Serveris naudoja service role — RLS politikų anonui nereikia.
