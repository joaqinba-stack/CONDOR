-- Fotos como producto. Pegar en Supabase → SQL Editor → Run (después de 0001_init.sql).

alter table videos
  add column if not exists kind text not null default 'video' check (kind in ('video', 'fotos')),
  add column if not exists image_count integer not null default 0;

create table if not exists product_images (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references videos (id) on delete cascade,
  path text not null unique,
  width integer not null,
  height integer not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists product_images_video_idx on product_images (video_id, position);

alter table product_images enable row level security;

-- Bucket PRIVADO: las fotos solo se ven con una URL firmada que genera el servidor
-- después de comprobar la compra.
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', false)
on conflict (id) do nothing;
