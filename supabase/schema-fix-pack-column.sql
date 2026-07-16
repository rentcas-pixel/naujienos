-- Paleisk SQL Editor’iuje. Tavo lentelėje yra "path", o app’ė rašo į "pack".

-- 1) Pridėk teisingą stulpelį
alter table public.topic_angle_packs
  add column if not exists pack jsonb;

-- 2) Jei "path" nenaudojamas — galima drop’inti (nebūtina)
-- alter table public.topic_angle_packs drop column if exists path;

-- 3) Reset gate, kad feed’as eitų per prepare
update public.publish_gate
set initialized = true,
    legacy_slugs = '{}',
    updated_at = now()
where id = 1;
