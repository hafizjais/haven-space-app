create table public.admins (
  email text primary key check (email = lower(email)),
  name text,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where email = lower(coalesce(auth.jwt()->>'email','')));
$$;

create table public.settings (
  id int primary key default 1 check (id = 1),
  company_name text, landlord_name text, landlord_ic text,
  bank_name text, account_name text, account_no text,
  witness_name text, witness_ic text,
  grace_days int not null default 7,
  low_collection_alert int not null default 80
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  address text,
  drive_url text, map_url text,
  owner_rent numeric(10,2) not null default 0,
  target_collected numeric(10,2) not null default 0,
  target_expenses numeric(10,2) not null default 0,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties on delete restrict,
  name text not null,
  price numeric(10,2) not null check (price >= 0),
  notes text,
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.rooms(property_id);

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  nickname text not null,
  ic_no text,
  phone text,
  notes text,
  created_at timestamptz not null default now()
);
create unique index tenants_ic_unique on public.tenants (regexp_replace(ic_no,'[^0-9]','','g')) where ic_no is not null and ic_no <> '';

create table public.tenancies (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms on delete restrict,
  tenant_id uuid not null references public.tenants on delete restrict,
  status text not null default 'active' check (status in ('active','ended')),
  monthly_rent numeric(10,2) not null check (monthly_rent >= 0),
  deposit numeric(10,2),
  pay_day int check (pay_day between 1 and 31),
  agreement_date date,
  start_date date,
  end_date date,
  moved_out_on date,
  signed boolean not null default false,
  doc_link text,
  remarks text,
  created_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create unique index one_active_tenancy_per_room on public.tenancies(room_id) where status = 'active';
create unique index one_active_tenancy_per_tenant on public.tenancies(tenant_id) where status = 'active';
create index on public.tenancies(tenant_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  tenancy_id uuid not null references public.tenancies on delete restrict,
  period date not null check (extract(day from period) = 1),
  amount numeric(10,2) not null check (amount > 0),
  paid_on date,
  method text,
  note text,
  created_by text default lower(auth.jwt()->>'email'),
  created_at timestamptz not null default now()
);
create index on public.payments(tenancy_id);
create index on public.payments(period);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties on delete restrict,
  period date not null check (extract(day from period) = 1),
  category text not null check (category in ('owner_rent','maintenance','electricity','water','wifi','cleaner','ads','shop','salary','renovation','other')),
  label text,
  amount numeric(10,2) not null check (amount >= 0),
  note text,
  created_by text default lower(auth.jwt()->>'email'),
  created_at timestamptz not null default now()
);
create index on public.expenses(period);

do $$ declare t text;
begin
  foreach t in array array['admins','settings','properties','rooms','tenants','tenancies','payments','expenses'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "admins full access" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

revoke all on function public.is_admin() from anon;
