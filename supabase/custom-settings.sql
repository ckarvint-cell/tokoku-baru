create table if not exists public.site_settings (
  id boolean primary key default true,
  store_name text not null default 'Tokoku',
  welcome_template text not null default '{greeting}, {name}',
  welcome_description text not null default 'Pilih koleksi favorit, masukkan ke keranjang, lalu upload bukti transfer saat checkout.',
  updated_at timestamptz not null default now(),
  constraint site_settings_singleton check (id = true)
);

create table if not exists public.payment_settings (
  id boolean primary key default true,
  bank_name text not null default '',
  account_number text not null default '',
  account_holder text not null default '',
  payment_logo_url text not null default '',
  payment_note text not null default 'Transfer sesuai subtotal lalu upload bukti transfer.',
  updated_at timestamptz not null default now(),
  constraint payment_settings_singleton check (id = true)
);

create table if not exists public.footer_settings (
  id boolean primary key default true,
  store_name text not null default 'Tokoku',
  address text not null default '',
  whatsapp text not null default '',
  email text not null default '',
  instagram text not null default '',
  copyright_text text not null default '© Tokoku. All rights reserved.',
  updated_at timestamptz not null default now(),
  constraint footer_settings_singleton check (id = true)
);

insert into public.site_settings (id)
values (true)
on conflict (id) do nothing;

insert into public.payment_settings (id)
values (true)
on conflict (id) do nothing;

insert into public.footer_settings (id)
values (true)
on conflict (id) do nothing;

alter table public.site_settings enable row level security;
alter table public.payment_settings enable row level security;
alter table public.footer_settings enable row level security;

drop policy if exists "Anyone can read site settings" on public.site_settings;
create policy "Anyone can read site settings"
on public.site_settings
for select
to anon, authenticated
using (true);

drop policy if exists "Admins can manage site settings" on public.site_settings;
create policy "Admins can manage site settings"
on public.site_settings
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Anyone can read payment settings" on public.payment_settings;
create policy "Anyone can read payment settings"
on public.payment_settings
for select
to anon, authenticated
using (true);

drop policy if exists "Admins can manage payment settings" on public.payment_settings;
create policy "Admins can manage payment settings"
on public.payment_settings
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Anyone can read footer settings" on public.footer_settings;
create policy "Anyone can read footer settings"
on public.footer_settings
for select
to anon, authenticated
using (true);

drop policy if exists "Admins can manage footer settings" on public.footer_settings;
create policy "Admins can manage footer settings"
on public.footer_settings
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
