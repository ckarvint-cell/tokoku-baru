"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Role = "admin" | "manager" | "customer";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: Role;
  created_at?: string | null;
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

  const loadProfiles = useCallback(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    setProfiles((data || []) as Profile[]);
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

  const filteredProfiles = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return profiles;

    return profiles.filter((profile) => {
      return [profile.full_name, profile.email, profile.role]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
    });
  }, [profiles, search]);

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
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <label className="grid gap-2 text-sm font-bold">
              Cari User
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari nama, email, atau role..."
                className="rounded-md border border-slate-300 px-3 py-2 font-medium outline-none focus:border-rose-400"
              />
            </label>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700">
              {filteredProfiles.length} user
            </div>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-[1.4fr_1fr_180px] gap-3 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
            <span>User</span>
            <span>Role Saat Ini</span>
            <span>Ubah Role</span>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredProfiles.map((profile) => (
              <div key={profile.id} className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[1.4fr_1fr_180px] md:items-center">
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
