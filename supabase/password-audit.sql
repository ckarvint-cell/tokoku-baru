create table if not exists public.password_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  changed_at timestamptz not null default now(),
  ip_address text,
  user_agent text
);

alter table public.password_audit_logs enable row level security;

drop policy if exists "Users can insert own password audit logs" on public.password_audit_logs;
create policy "Users can insert own password audit logs"
on public.password_audit_logs
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can read own password audit logs" on public.password_audit_logs;
create policy "Users can read own password audit logs"
on public.password_audit_logs
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Admins can read all password audit logs" on public.password_audit_logs;
create policy "Admins can read all password audit logs"
on public.password_audit_logs
for select
to authenticated
using (public.is_admin());
