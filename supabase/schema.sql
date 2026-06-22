create extension if not exists "uuid-ossp";

create type plan_code as enum ('free', 'personal', 'business');
create type company_role as enum ('admin', 'member');
create type customer_type as enum ('individual', 'corporate');
create type project_status as enum ('estimating', 'submitted', 'won', 'lost');
create type unit_code as enum ('sqm', 'm', 'piece', 'machine', 'place', 'set', 'labor');
create type discount_type as enum ('amount', 'percent');

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.companies (
  id uuid primary key default uuid_generate_v4(),
  owner_user_id uuid not null references public.users(id),
  name text not null,
  logo_path text,
  postal_code text,
  address text,
  phone text,
  email text,
  bank_account text,
  invoice_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.company_users (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role company_role not null default 'member',
  invited_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  unique(company_id, user_id)
);

create table public.subscriptions (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  plan_code plan_code not null default 'free',
  status text not null default 'active',
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id)
);

create table public.customers (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  type customer_type not null default 'individual',
  name text not null,
  company_name text,
  contact_name text,
  phone text,
  email text,
  postal_code text,
  address text,
  memo text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  title text not null,
  status project_status not null default 'estimating',
  memo text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_photos (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  storage_path text not null,
  comment text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create table public.trades (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references public.companies(id) on delete cascade,
  name text not null,
  sort_order int not null default 100,
  is_system_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.work_items (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references public.companies(id) on delete cascade,
  trade_id uuid not null references public.trades(id) on delete cascade,
  name text not null,
  unit unit_code not null,
  standard_price numeric(12,2) not null default 0,
  material_cost numeric(12,2) not null default 0,
  labor_cost numeric(12,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.estimates (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  estimate_no text not null,
  issue_date date not null default current_date,
  subtotal numeric(12,2) not null default 0,
  discount_type discount_type not null default 'amount',
  discount_value numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  tax_rate numeric(5,4) not null default 0.1,
  tax_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  note text,
  pdf_path text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, estimate_no)
);

create table public.estimate_items (
  id uuid primary key default uuid_generate_v4(),
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  trade_id uuid references public.trades(id),
  work_item_id uuid references public.work_items(id),
  name text not null,
  unit unit_code not null,
  quantity numeric(12,2) not null,
  unit_price numeric(12,2) not null,
  material_cost numeric(12,2) not null default 0,
  labor_cost numeric(12,2) not null default 0,
  line_total numeric(12,2) not null,
  sort_order int not null default 100
);

create table public.sync_events (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  client_event_id text not null,
  entity_type text not null,
  entity_id uuid,
  payload jsonb not null,
  synced_at timestamptz not null default now(),
  unique(company_id, client_event_id)
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_company_member(target_company_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.company_users cu
    where cu.company_id = target_company_id and cu.user_id = auth.uid()
  );
$$;

create or replace function public.is_company_admin(target_company_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.company_users cu
    where cu.company_id = target_company_id and cu.user_id = auth.uid() and cu.role = 'admin'
  );
$$;

alter table public.users enable row level security;
alter table public.companies enable row level security;
alter table public.company_users enable row level security;
alter table public.subscriptions enable row level security;
alter table public.customers enable row level security;
alter table public.projects enable row level security;
alter table public.project_photos enable row level security;
alter table public.trades enable row level security;
alter table public.work_items enable row level security;
alter table public.estimates enable row level security;
alter table public.estimate_items enable row level security;
alter table public.sync_events enable row level security;

create policy "users can read self" on public.users for select using (id = auth.uid());
create policy "users can update self" on public.users for update using (id = auth.uid());

create policy "users can create own company" on public.companies for insert with check (owner_user_id = auth.uid());
create policy "members read company" on public.companies for select using (public.is_company_member(id));
create policy "admins update company" on public.companies for update using (public.is_company_admin(id));

create policy "members read company_users" on public.company_users for select using (public.is_company_member(company_id));
create policy "admins manage company_users" on public.company_users for all using (public.is_company_admin(company_id));
create policy "owner can create first admin membership" on public.company_users for insert with check (
  user_id = auth.uid()
  and role = 'admin'
  and exists (select 1 from public.companies c where c.id = company_id and c.owner_user_id = auth.uid())
);

create policy "members read subscriptions" on public.subscriptions for select using (public.is_company_member(company_id));
create policy "admins manage subscriptions" on public.subscriptions for all using (public.is_company_admin(company_id));

create policy "members manage customers" on public.customers for all using (public.is_company_member(company_id));
create policy "members manage projects" on public.projects for all using (public.is_company_member(company_id));
create policy "members manage photos" on public.project_photos for all using (public.is_company_member(company_id));
create policy "members read trades" on public.trades for select using (company_id is null or public.is_company_member(company_id));
create policy "admins manage trades" on public.trades for all using (company_id is not null and public.is_company_admin(company_id));
create policy "members read work_items" on public.work_items for select using (company_id is null or public.is_company_member(company_id));
create policy "admins manage work_items" on public.work_items for all using (company_id is not null and public.is_company_admin(company_id));
create policy "members manage estimates" on public.estimates for all using (public.is_company_member(company_id));
create policy "members manage estimate_items" on public.estimate_items for all using (
  exists (select 1 from public.estimates e where e.id = estimate_id and public.is_company_member(e.company_id))
);
create policy "members manage sync_events" on public.sync_events for all using (public.is_company_member(company_id));

insert into public.trades (id, name, sort_order, is_system_default) values
  ('00000000-0000-0000-0000-000000000101', 'クロス', 10, true),
  ('00000000-0000-0000-0000-000000000102', '塗装', 20, true),
  ('00000000-0000-0000-0000-000000000103', '防水', 30, true),
  ('00000000-0000-0000-0000-000000000104', '左官', 40, true),
  ('00000000-0000-0000-0000-000000000105', '電気', 50, true),
  ('00000000-0000-0000-0000-000000000106', '設備', 60, true),
  ('00000000-0000-0000-0000-000000000107', 'ハウスクリーニング', 70, true);

create index customers_company_id_idx on public.customers(company_id);
create index projects_company_id_idx on public.projects(company_id);
create index projects_customer_id_idx on public.projects(customer_id);
create index estimates_company_id_idx on public.estimates(company_id);
create index estimates_project_id_idx on public.estimates(project_id);
create index estimate_items_estimate_id_idx on public.estimate_items(estimate_id);
create index project_photos_project_id_idx on public.project_photos(project_id);

insert into storage.buckets (id, name, public) values
  ('company-logos', 'company-logos', true),
  ('project-photos', 'project-photos', false),
  ('estimate-pdfs', 'estimate-pdfs', false)
on conflict (id) do nothing;

create policy "members read company logos" on storage.objects for select using (bucket_id = 'company-logos');
create policy "members upload company logos" on storage.objects for insert with check (bucket_id = 'company-logos' and auth.uid() is not null);
create policy "members read project photos" on storage.objects for select using (bucket_id = 'project-photos' and auth.uid() is not null);
create policy "members upload project photos" on storage.objects for insert with check (bucket_id = 'project-photos' and auth.uid() is not null);
create policy "members read estimate pdfs" on storage.objects for select using (bucket_id = 'estimate-pdfs' and auth.uid() is not null);
create policy "members upload estimate pdfs" on storage.objects for insert with check (bucket_id = 'estimate-pdfs' and auth.uid() is not null);
