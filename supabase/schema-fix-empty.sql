-- Paleisk SQL Editor’iuje (sutvarko tuščias / neteisingas lenteles)

-- Gate
insert into public.publish_gate (id, initialized, legacy_slugs)
values (1, true, '{}')
on conflict (id) do update
set initialized = true,
    legacy_slugs = '{}',
    updated_at = now();

-- Pack stulpelis (app’ė jo reikia)
alter table public.topic_angle_packs
  add column if not exists pack jsonb;

alter table public.topic_angle_packs
  add column if not exists article jsonb;

alter table public.topic_angle_packs
  add column if not exists title text;

alter table public.topic_angle_packs
  add column if not exists excerpt text;
