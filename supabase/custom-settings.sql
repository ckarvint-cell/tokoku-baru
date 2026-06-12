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

create table if not exists public.courier_settings (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
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
alter table public.courier_settings enable row level security;

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

drop policy if exists "Authenticated users can read courier settings" on public.courier_settings;
create policy "Authenticated users can read courier settings"
on public.courier_settings
for select
to authenticated
using (true);

drop policy if exists "Admins can manage courier settings" on public.courier_settings;
create policy "Admins can manage courier settings"
on public.courier_settings
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-assets', 'payment-assets', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can read payment assets" on storage.objects;
create policy "Anyone can read payment assets"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'payment-assets');

drop policy if exists "Admins can upload payment assets" on storage.objects;
create policy "Admins can upload payment assets"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'payment-assets' and public.is_admin());

drop policy if exists "Admins can update payment assets" on storage.objects;
create policy "Admins can update payment assets"
on storage.objects
for update
to authenticated
using (bucket_id = 'payment-assets' and public.is_admin())
with check (bucket_id = 'payment-assets' and public.is_admin());

drop policy if exists "Admins can delete payment assets" on storage.objects;
create policy "Admins can delete payment assets"
on storage.objects
for delete
to authenticated
using (bucket_id = 'payment-assets' and public.is_admin());
