-- Final Barber — Supabase schema.
-- Run once in Supabase → SQL Editor. Then `pnpm db:seed` loads the Mister Bigode catalog
-- (and, with --demo, the demo history).
--
-- The app talks to these tables only from the server, with the secret key, so RLS is
-- enabled with no policies: nothing is reachable with the public (anon/publishable) key.
--
-- Rodou uma versão anterior deste arquivo? Como ainda não há dados reais, o mais simples é
-- apagar as tabelas e rodar tudo de novo (descomente as linhas abaixo uma vez):
-- drop table if exists gallery_photos, plan_leads, product_reservations, product_sales,
--   appointments, subscriptions, customers, products, plans, services, barbers, units,
--   shop_settings cascade;

create table if not exists shop_settings (
  id int primary key default 1 check (id = 1),
  name text not null,
  tagline text not null,
  instagram text not null,
  member_count_label text not null,
  rating_label text not null,
  cover_photo_url text,
  -- [{"url": "...", "caption": "...", "barberId": "barber-..." | null}]
  portfolio jsonb not null default '[]'
);

alter table shop_settings add column if not exists referral_rules jsonb;

create table if not exists units (
  id text primary key,
  name text not null,
  address text not null,
  phone text,
  photo_url text,
  -- 7 entries, Sunday first: {"open": 540, "close": 1200} in minutes, or null when closed.
  hours jsonb not null
);

create table if not exists barbers (
  id text primary key,
  name text not null,
  unit_id text not null references units(id),
  active boolean not null default true,
  service_commission numeric(4,3) not null default 0.4,
  product_commission numeric(4,3) not null default 0.1
);

create table if not exists services (
  id text primary key,
  name text not null,
  category text not null check (category in ('hair','beard','treatment','finishing')),
  duration_min int not null,
  price_cents int not null,
  coverage text check (coverage in ('haircut','beard')),
  bookable boolean not null default true
);

create table if not exists plans (
  id text primary key,
  name text not null,
  tier text not null check (tier in ('plus','premium')),
  covers text[] not null,
  price_cents int not null,
  highlight text check (highlight in ('best_seller')),
  benefits text[] not null default '{}',
  sort_order int not null default 0
);
-- Appointments a month a plan includes (null = not stated; confirmed by the team).
alter table plans add column if not exists monthly_limit int check (monthly_limit > 0);

create table if not exists products (
  id text primary key,
  name text not null,
  category text not null check (category in ('hair','beard','skin','accessory')),
  description text not null default '',
  price_cents int not null,
  cost_cents int not null default 0,
  stock int not null default 0,
  min_stock int not null default 0,
  active boolean not null default true,
  photo_url text
);

create table if not exists customers (
  id text primary key,
  name text not null,
  phone text not null,
  cycle_days int not null default 30,
  preferred_barber_id text references barbers(id),
  created_at timestamptz not null default now(),
  -- Account holder ("titular") who manages this person; null = this customer is a holder.
  holder_id text references customers(id),
  relationship text check (relationship in ('child','spouse','parent','parent_in_law','sibling','other')),
  minor boolean not null default false,
  referral_code text not null unique,
  check ((holder_id is null) = (relationship is null))
);
create index if not exists customers_holder_idx on customers (holder_id);

create table if not exists subscriptions (
  id text primary key,
  customer_id text not null references customers(id),
  payer_customer_id text not null references customers(id),
  plan_id text not null references plans(id),
  status text not null check (status in ('active','paused','past_due','canceled')),
  started_at timestamptz not null,
  canceled_at timestamptz,
  billing_day int not null check (billing_day between 1 and 28),
  sold_by_barber_id text references barbers(id),
  channel text not null check (channel in ('app','counter','whatsapp')),
  -- Member whose invite brought this subscription (earns 50% off one monthly fee).
  referred_by_customer_id text references customers(id)
);
-- One plan in force per person: several plans per account, never two for the same person.
alter table subscriptions add column if not exists cancel_reason text;
create unique index if not exists subscriptions_one_per_person on subscriptions (customer_id) where status <> 'canceled';

create table if not exists appointments (
  id text primary key,
  customer_id text not null references customers(id),
  barber_id text not null references barbers(id),
  unit_id text not null references units(id),
  service_ids text[] not null,
  starts_at timestamptz not null,
  duration_min int not null,
  status text not null check (status in ('scheduled','completed','no_show','canceled')),
  charged_cents int not null default 0,
  covered_cents int not null default 0,
  subscription_id text references subscriptions(id),
  group_id text,
  channel text not null check (channel in ('app','counter','whatsapp'))
);
create index if not exists appointments_starts_at_idx on appointments (starts_at);
create index if not exists appointments_barber_idx on appointments (barber_id, starts_at);

create table if not exists product_sales (
  id text primary key,
  product_id text not null references products(id),
  barber_id text references barbers(id),
  customer_id text references customers(id),
  unit_id text not null references units(id),
  quantity int not null,
  unit_price_cents int not null,
  sold_at timestamptz not null
);
create index if not exists product_sales_sold_at_idx on product_sales (sold_at);

create table if not exists product_reservations (
  id text primary key,
  product_id text not null references products(id),
  customer_id text not null references customers(id),
  quantity int not null default 1,
  status text not null check (status in ('reserved','picked_up','canceled')),
  created_at timestamptz not null default now()
);

create table if not exists plan_leads (
  id text primary key,
  -- Who the plan is for, and the account holder who asked for it.
  customer_id text not null references customers(id),
  requested_by_id text not null references customers(id),
  plan_id text not null references plans(id),
  kind text not null default 'new' check (kind in ('new','upgrade')),
  referrer_customer_id text references customers(id),
  created_at timestamptz not null default now()
);

create table if not exists gallery_photos (
  id text primary key,
  customer_id text not null references customers(id),
  appointment_id text references appointments(id),
  side text not null check (side in ('before','after')),
  url text not null,
  created_at timestamptz not null default now()
);

-- Messages the owner opened from an assistant suggestion (for the assistant's scoreboard).
create table if not exists assistant_actions (
  id text primary key,
  kind text not null,
  customer_id text not null references customers(id),
  created_at timestamptz not null default now()
);
create index if not exists assistant_actions_created_idx on assistant_actions (created_at);

alter table shop_settings enable row level security;
alter table units enable row level security;
alter table barbers enable row level security;
alter table services enable row level security;
alter table plans enable row level security;
alter table products enable row level security;
alter table customers enable row level security;
alter table subscriptions enable row level security;
alter table appointments enable row level security;
alter table product_sales enable row level security;
alter table product_reservations enable row level security;
alter table plan_leads enable row level security;
alter table gallery_photos enable row level security;
alter table assistant_actions enable row level security;

-- Data API access: only the server's secret key (service_role) may touch these tables.
-- Explicit so it works with "Automatically expose new tables" turned off (recommended).
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
revoke all on all tables in schema public from anon, authenticated;
