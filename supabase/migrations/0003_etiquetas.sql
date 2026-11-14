-- Etiquetas y referencia a ManyVids. Pegar en Supabase → SQL Editor → Run (después de 0002).

alter table videos
  add column if not exists tags text[] not null default '{}',
  add column if not exists manyvids_id text unique;

create index if not exists videos_tags_idx on videos using gin (tags);

-- Productos gratis: el precio 0 ya estaba permitido (check >= 0).
