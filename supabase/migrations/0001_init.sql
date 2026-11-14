-- Esquema inicial de la tienda. Pegar en Supabase → SQL Editor → Run.

create extension if not exists "pgcrypto";

create table if not exists videos (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  title_en text,
  description_en text,
  price_usd_cents integer not null check (price_usd_cents >= 0),
  price_ars_cents integer not null check (price_ars_cents >= 0),
  bunny_video_id text unique,
  trailer_video_id text unique,
  trailer_url text,
  cover_url text,
  width integer not null default 16,
  height integer not null default 9,
  duration_seconds integer not null default 0,
  status text not null default 'borrador' check (status in ('borrador', 'procesando', 'publicado')),
  publish_when_ready boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  video_id uuid not null references videos (id) on delete restrict,
  provider text not null check (provider in ('mercadopago', 'paypal', 'manual')),
  provider_ref text,
  currency text not null check (currency in ('ARS', 'USD')),
  amount_cents integer not null check (amount_cents >= 0),
  status text not null default 'pendiente' check (status in ('pendiente', 'pagada', 'reembolsada', 'fallida')),
  locale text not null default 'es',
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists orders_provider_ref_idx on orders (provider, provider_ref);
create index if not exists orders_email_idx on orders (email);

-- Lo que decide si un email puede ver un video.
create table if not exists entitlements (
  email text not null,
  video_id uuid not null references videos (id) on delete cascade,
  order_id uuid references orders (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (email, video_id)
);

create table if not exists settings (
  key text primary key,
  value text not null
);

-- Links de acceso de un solo uso (se guarda solo el hash).
create table if not exists login_tokens (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists login_tokens_email_idx on login_tokens (email, created_at);

-- RLS activado y sin políticas: nadie con la clave pública puede leer ni escribir.
-- El servidor usa la service role key, que no pasa por RLS.
alter table videos enable row level security;
alter table orders enable row level security;
alter table entitlements enable row level security;
alter table settings enable row level security;
alter table login_tokens enable row level security;

-- Bucket público para las portadas.
insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do nothing;
