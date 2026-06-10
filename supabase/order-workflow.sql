create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  customer_name text,
  customer_phone text,
  shipping_address text,
  maps_url text,
  total_produk numeric(12,2) not null default 0,
  shipping_cost numeric(12,2) not null default 0,
  grand_total numeric(12,2) not null default 0,
  status text not null default 'Menunggu Ongkir',
  payment_proof_url text,
  payment_rejected_reason text,
  tracking_number text,
  courier_name text,
  courier_logo_url text,
  tracking_url text,
  paid_at timestamptz,
  shipped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orders add column if not exists customer_id uuid references auth.users(id) on delete cascade;
alter table public.orders add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.orders add column if not exists customer_name text;
alter table public.orders add column if not exists customer_phone text;
alter table public.orders add column if not exists shipping_address text;
alter table public.orders add column if not exists maps_url text;
alter table public.orders add column if not exists total_produk numeric(12,2) not null default 0;
alter table public.orders add column if not exists shipping_cost numeric(12,2) not null default 0;
alter table public.orders add column if not exists ongkir numeric(12,2) not null default 0;
alter table public.orders add column if not exists grand_total numeric(12,2) not null default 0;
alter table public.orders add column if not exists status text not null default 'Menunggu Ongkir';
alter table public.orders add column if not exists status_pesanan text;
alter table public.orders add column if not exists payment_proof_url text;
alter table public.orders add column if not exists bukti_pembayaran text;
alter table public.orders add column if not exists bukti_transfer text;
alter table public.orders add column if not exists proof_url text;
alter table public.orders add column if not exists payment_receipt_url text;
alter table public.orders add column if not exists receipt_url text;
alter table public.orders add column if not exists payment_rejected_reason text;
alter table public.orders add column if not exists tracking_number text;
alter table public.orders add column if not exists courier_name text;
alter table public.orders add column if not exists courier_logo_url text;
alter table public.orders add column if not exists tracking_url text;
alter table public.orders add column if not exists paid_at timestamptz;
alter table public.orders add column if not exists shipped_at timestamptz;
alter table public.orders add column if not exists updated_at timestamptz not null default now();

update public.orders
set customer_id = coalesce(customer_id, user_id),
    user_id = coalesce(user_id, customer_id)
where customer_id is null
   or user_id is null;

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders
  add constraint orders_status_check
  check (status in ('Menunggu Ongkir', 'Menunggu Pembayaran', 'Pesanan Dikirim', 'Ditolak'));

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  nama_produk text not null,
  harga numeric(12,2) not null default 0,
  qty int not null default 1,
  note text,
  created_at timestamptz not null default now()
);

alter table public.order_items add column if not exists note text;
alter table public.order_items add column if not exists catatan text;
alter table public.order_items add column if not exists catatan_produk text;
alter table public.order_items add column if not exists item_note text;
alter table public.order_items add column if not exists keterangan text;

create or replace function public.is_manager_or_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('admin', 'manager')
  );
$$;

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "Customers can read own orders" on public.orders;
create policy "Customers can read own orders"
on public.orders
for select
using (auth.uid() = coalesce(customer_id, user_id));

drop policy if exists "Managers can read all orders" on public.orders;
create policy "Managers can read all orders"
on public.orders
for select
using (public.is_manager_or_admin());

drop policy if exists "Customers can create own orders" on public.orders;
create policy "Customers can create own orders"
on public.orders
for insert
with check (
  auth.uid() = coalesce(customer_id, user_id)
  and status = 'Menunggu Ongkir'
  and shipping_cost = 0
  and payment_proof_url is null
  and tracking_number is null
);

drop policy if exists "Managers can update orders" on public.orders;
create policy "Managers can update orders"
on public.orders
for update
using (public.is_manager_or_admin())
with check (public.is_manager_or_admin());

drop policy if exists "Customers can read own order items" on public.order_items;
create policy "Customers can read own order items"
on public.order_items
for select
using (
  exists (
    select 1
    from public.orders
    where orders.id = order_items.order_id
      and coalesce(orders.customer_id, orders.user_id) = auth.uid()
  )
);

drop policy if exists "Managers can read all order items" on public.order_items;
create policy "Managers can read all order items"
on public.order_items
for select
using (public.is_manager_or_admin());

drop policy if exists "Customers can create own order items" on public.order_items;
create policy "Customers can create own order items"
on public.order_items
for insert
with check (
  exists (
    select 1
    from public.orders
    where orders.id = order_items.order_id
      and coalesce(orders.customer_id, orders.user_id) = auth.uid()
      and orders.status = 'Menunggu Ongkir'
  )
);

drop function if exists public.customer_upload_payment_proof(uuid, text);

create or replace function public.customer_upload_payment_proof(order_id_to_update uuid, proof_url text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_count int;
  proof_value text := proof_url;
begin
  update public.orders
  set payment_proof_url = proof_value,
      bukti_pembayaran = proof_value,
      bukti_transfer = proof_value,
      proof_url = proof_value,
      payment_receipt_url = proof_value,
      receipt_url = proof_value,
      updated_at = now()
  where id = order_id_to_update
    and coalesce(customer_id, user_id) = auth.uid()
    and coalesce(shipping_cost, ongkir, 0) > 0;

  get diagnostics affected_count = row_count;

  if affected_count = 0 then
    raise exception 'Pesanan tidak ditemukan, bukan milik user ini, atau ongkir belum ditentukan.';
  end if;

  return proof_value;
end;
$$;

grant execute on function public.customer_upload_payment_proof(uuid, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Customers upload own payment proofs" on storage.objects;
create policy "Customers upload own payment proofs"
on storage.objects
for insert
with check (
  bucket_id = 'payment-proofs'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Authenticated users read payment proofs" on storage.objects;
create policy "Authenticated users read payment proofs"
on storage.objects
for select
using (
  bucket_id = 'payment-proofs'
  and auth.role() = 'authenticated'
);

notify pgrst, 'reload schema';
