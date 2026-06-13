"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Role = "admin" | "manager" | "customer";
type RoleFilter = Role | "semua";
type ManagerMenuKey = "dashboard" | "products" | "customers" | "orders" | "vouchers" | "finance" | "custom" | "settings" | "roles";

type RolePermission = {
  menu_key: ManagerMenuKey;
  enabled: boolean;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: Role;
  created_at?: string | null;
  aktif?: boolean | null;
};

const roles: { value: Role; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "customer", label: "Customer" },
];

const managerActions: { key: ManagerMenuKey; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "products", label: "Produk" },
  { key: "customers", label: "Customer" },
  { key: "orders", label: "Pesanan" },
  { key: "vouchers", label: "Voucher" },
  { key: "finance", label: "Keuangan" },
  { key: "custom", label: "Custom" },
  { key: "settings", label: "Setting" },
  { key: "roles", label: "Role" },
];

const defaultManagerPermissions = Object.fromEntries(
  managerActions.map((action) => [action.key, action.key !== "roles"]),
) as Record<ManagerMenuKey, boolean>;

const rolePermissionSql = [
  "create table if not exists public.role_permissions (",
  "  role text not null,",
  "  menu_key text not null,",
  "  enabled boolean not null default true,",
  "  updated_at timestamptz not null default now(),",
  "  primary key (role, menu_key)",
  ");",
  "",
  "alter table public.role_permissions enable row level security;",
  "",
  "create policy if not exists \"Admin can manage role permissions\"",
  "  on public.role_permissions",
  "  for all",
  "  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'))",
  "  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));",
  "",
  "create policy if not exists \"Admin and manager can read role permissions\"",
  "  on public.role_permissions",
  "  for select",
  "  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role in ('admin','manager')));",
].join("\n");

function roleLabel(role: Role) {
  return roles.find((item) => item.value === role)?.label || role;
}

function roleClass(role: Role) {
  if (role === "admin") return "border-rose-200 bg-rose-50 text-rose-700";
  if (role === "manager") return "border-indigo-200 bg-indigo-50 text-indigo-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default function AdminRolesPage() {
  const router = useRouter();
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("semua");
  const [managerPermissions, setManagerPermissions] = useState<Record<ManagerMenuKey, boolean>>(defaultManagerPermissions);
  const [savingPermission, setSavingPermission] = useState("");

  const loadManagerPermissions = useCallback(async () => {
    const { data, error } = await supabase
      .from("role_permissions")
      .select("menu_key, enabled")
      .eq("role", "manager");

    if (error) {
      setMessage(error.message.includes("role_permissions") || error.message.includes("schema cache")
        ? `Tabel role_permissions belum ada. Jalankan SQL berikut di Supabase SQL Editor:\n\n${rolePermissionSql}`
        : error.message);
      return;
    }

    const savedPermissions = Object.fromEntries(
      ((data || []) as RolePermission[]).map((item) => [item.menu_key, item.enabled]),
    ) as Partial<Record<ManagerMenuKey, boolean>>;

    setManagerPermissions({ ...defaultManagerPermissions, ...savedPermissions });
  }, []);

  const loadProfiles = useCallback(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, created_at, aktif")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message.includes("aktif") || error.message.includes("schema cache")
        ? "Kolom aktif belum ada di tabel profiles. Jalankan SQL: alter table public.profiles add column if not exists aktif boolean not null default true;"
        : error.message);
      return;
    }

    setProfiles(((data || []) as Profile[]).map((profile) => ({ ...profile, aktif: profile.aktif ?? true })));
  }, []);

  useEffect(() => {
    async function checkAccessAndLoad() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .eq("id", user.id)
        .single();

      if (!profileData || profileData.role !== "admin") {
        router.push("/admin");
        return;
      }

      setCurrentProfile(profileData as Profile);
      await Promise.all([loadProfiles(), loadManagerPermissions()]);
      setLoading(false);
    }

    checkAccessAndLoad();
  }, [router, loadProfiles, loadManagerPermissions]);

  async function updateRole(profile: Profile, nextRole: Role) {
    if (currentProfile?.role !== "admin") {
      setMessage("Hanya admin yang dapat mengubah role user.");
      return;
    }

    setSavingId(profile.id);
    setMessage("");

    const { error } = await supabase
      .from("profiles")
      .update({ role: nextRole })
      .eq("id", profile.id);

    if (error) {
      setMessage(error.message);
      setSavingId("");
      return;
    }

    setProfiles((current) => current.map((item) => (item.id === profile.id ? { ...item, role: nextRole } : item)));
    setMessage(`Role ${profile.email || profile.full_name || "user"} berhasil diubah menjadi ${roleLabel(nextRole)}.`);
    setSavingId("");
  }

  async function updateActiveStatus(profile: Profile, nextActive: boolean) {
    if (currentProfile?.role !== "admin") {
      setMessage("Hanya admin yang dapat mengubah status user.");
      return;
    }

    if (profile.role === "admin" && !nextActive) {
      setMessage("Admin tidak bisa dinonaktifkan.");
      return;
    }

    setSavingId(profile.id);
    setMessage("");

    const { error } = await supabase
      .from("profiles")
      .update({ aktif: nextActive })
      .eq("id", profile.id);

    if (error) {
      setMessage(error.message.includes("aktif") || error.message.includes("schema cache")
        ? "Kolom aktif belum ada di tabel profiles. Jalankan SQL: alter table public.profiles add column if not exists aktif boolean not null default true;"
        : error.message);
      setSavingId("");
      return;
    }

    setProfiles((current) => current.map((item) => (item.id === profile.id ? { ...item, aktif: nextActive } : item)));
    setMessage(`User ${profile.email || profile.full_name || "user"} berhasil ${nextActive ? "diaktifkan" : "dinonaktifkan"}.`);
    setSavingId("");
  }

  async function updateManagerPermission(menuKey: ManagerMenuKey, enabled: boolean) {
    if (currentProfile?.role !== "admin") {
      setMessage("Hanya admin yang dapat mengubah akses manager.");
      return;
    }

    setSavingPermission(menuKey);
    setMessage("");

    const { error } = await supabase
      .from("role_permissions")
      .upsert(
        { role: "manager", menu_key: menuKey, enabled, updated_at: new Date().toISOString() },
        { onConflict: "role,menu_key" },
      );

    if (error) {
      setMessage(error.message.includes("role_permissions") || error.message.includes("schema cache")
        ? `Tabel role_permissions belum ada. Jalankan SQL berikut di Supabase SQL Editor:\n\n${rolePermissionSql}`
        : error.message);
      setSavingPermission("");
      return;
    }

    setManagerPermissions((current) => ({ ...current, [menuKey]: enabled }));
    setMessage(`Akses manager untuk ${managerActions.find((action) => action.key === menuKey)?.label || menuKey} berhasil ${enabled ? "diaktifkan" : "dinonaktifkan"}.`);
    setSavingPermission("");
  }

  const filteredProfiles = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return profiles.filter((profile) => {
      const matchesRole = roleFilter === "semua" || profile.role === roleFilter;
      const matchesSearch = !keyword || [profile.full_name, profile.email, profile.role]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));

      return matchesRole && matchesSearch;
    });
  }, [profiles, search, roleFilter]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-950">
        <p className="text-sm font-medium text-slate-600">Memeriksa akses role...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{currentProfile?.email}</p>
            <h1 className="mt-1 text-2xl font-bold">Role</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium">
              Kembali ke Admin
            </Link>
            <Link href="/" className="rounded-md bg-slate-950 px-4 py-2 text-sm font-bold text-white">
              Lihat Website
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-8">
        {message && (
          <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            {message}
          </div>
        )}

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[1fr_220px_auto] md:items-end">
            <label className="grid gap-2 text-sm font-bold">
              Cari User
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari nama, email, atau role..."
                className="rounded-md border border-slate-300 px-3 py-2 font-medium outline-none focus:border-rose-400"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold">
              Filter Role
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}
                className="rounded-md border border-slate-300 px-3 py-2 font-medium outline-none focus:border-rose-400"
              >
                <option value="semua">Semua role</option>
                {roles.map((role) => (
                  <option key={role.value} value={role.value}>{role.label}</option>
                ))}
              </select>
            </label>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700">
              {filteredProfiles.length} user
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-rose-500">Manager Action</p>
              <h2 className="mt-1 text-xl font-bold">Akses Panel Manager</h2>
            </div>
            <p className="text-sm text-slate-500">Toggle kiri/kanan untuk menentukan menu yang terlihat di akun Manager.</p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {managerActions.map((action) => {
              const enabled = managerPermissions[action.key] ?? false;

              return (
                <div key={action.key} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <span className="text-sm font-bold text-slate-800">{action.label}</span>
                  <button
                    type="button"
                    disabled={savingPermission === action.key}
                    onClick={() => updateManagerPermission(action.key, !enabled)}
                    className={`relative h-7 w-14 rounded-full transition disabled:opacity-60 ${enabled ? "bg-emerald-500" : "bg-slate-300"}`}
                    aria-label={`${enabled ? "Nonaktifkan" : "Aktifkan"} akses manager untuk ${action.label}`}
                  >
                    <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${enabled ? "left-8" : "left-1"}`} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[56px_1.4fr_1fr_180px_150px] gap-3 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-500 md:grid">
            <span>No</span>
            <span>User</span>
            <span>Role Saat Ini</span>
            <span>Ubah Role</span>
            <span>Status</span>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredProfiles.map((profile, index) => (
              <div key={profile.id} className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[56px_1.4fr_1fr_180px_150px] md:items-center">
                <div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400 md:text-sm md:tracking-normal md:text-slate-700">
                  <span className="md:hidden">No: </span>{index + 1}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-bold text-slate-950">{profile.full_name || "Tanpa nama"}</p>
                  <p className="truncate text-xs text-slate-500">{profile.email || "Email belum ada"}</p>
                </div>
                <div>
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${roleClass(profile.role)}`}>
                    {roleLabel(profile.role)}
                  </span>
                </div>
                <select
                  value={profile.role}
                  disabled={savingId === profile.id}
                  onChange={(event) => updateRole(profile, event.target.value as Role)}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium outline-none focus:border-rose-400 disabled:opacity-50"
                >
                  {roles.map((role) => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
                <select
                  value={(profile.aktif ?? true) ? "aktif" : "nonaktif"}
                  disabled={savingId === profile.id || profile.role === "admin"}
                  onChange={(event) => updateActiveStatus(profile, event.target.value === "aktif")}
                  title={profile.role === "admin" ? "Admin tidak bisa dinonaktifkan." : undefined}
                  className={`rounded-md border px-3 py-2 text-sm font-bold outline-none disabled:cursor-not-allowed disabled:opacity-60 ${(profile.aktif ?? true) ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-500"}`}
                >
                  <option value="aktif">Aktif</option>
                  <option value="nonaktif">Nonaktif</option>
                </select>
              </div>
            ))}
          </div>

          {filteredProfiles.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-slate-500">
              Tidak ada user yang cocok.
            </div>
          )}
        </div>

        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          <strong>Catatan:</strong> jika toggle Manager Action belum bisa disimpan, jalankan SQL role_permissions yang tampil pada pesan error di Supabase SQL Editor.
        </div>
      </section>
    </main>
  );
}
