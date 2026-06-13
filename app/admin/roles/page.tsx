"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Role = "admin" | "manager" | "customer";
type RoleFilter = Role | "semua";

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
      await loadProfiles();
      setLoading(false);
    }

    checkAccessAndLoad();
  }, [router, loadProfiles]);

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
          <strong>Catatan:</strong> halaman ini sudah bisa mengubah role user. Toggle detail akses manager per menu akan kita tambahkan di tahap berikutnya.
        </div>
      </section>
    </main>
  );
}
