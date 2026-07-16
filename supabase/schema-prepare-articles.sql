-- Paleisk SQL Editor’iuje (papildymas prie schema.sql).

alter table public.topic_angle_packs
  add column if not exists title text,
  add column if not exists excerpt text,
  add column if not exists article jsonb;

-- Senos eilutės su pack, bet be article — grąžinam į pending (ištrinam ready be article)
-- Neprivaloma: paliekam. App’ė ready reikalės ir article.
