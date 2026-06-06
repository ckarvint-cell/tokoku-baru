"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type ProfileForm = {
  fullName: string;
  username: string;
  email: string;
  phone: string;
  address: string;
  mapsUrl: string;
};

export default function SettingsPage() {
  const router = useRouter();
  const [form, setForm] = useState<ProfileForm>({
    fullName: "",
    username: "",
    email: "",
    phone: "",
    address: "",
    mapsUrl: "",
  });
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        router.push("/login");
        return;
      }

      setUserId(user.id);

      const { data } = await supabase
        .from("profiles")
        .select("full_name, username, email, phone, address, maps_url")
        .eq("id", user.id)
        .single();

      setForm({
        fullName: data?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || "",
        username: data?.username || "",
        email: data?.email || user.email || "",
        phone: data?.phone || "",
        address: data?.address || "",
        mapsUrl: data?.maps_url || "",
      });
      setLoading(false);
    }

    loadProfile();
  }, [router]);

  function updateField(name: keyof ProfileForm, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setSuccess(false);

    const { data: existingUsername } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", form.username)
      .neq("id", userId)
      .maybeSingle();

    if (existingUsername) {
      setSaving(false);
      setMessage("Username ini sudah digunakan oleh pengguna lain. Silakan gunakan username yang berbeda.");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: form.fullName,
        username: form.username,
        phone: form.phone,
        address: form.address,
        maps_url: form.mapsUrl,
      })
      .eq("id", userId);

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setSuccess(true);
    setMessage("Profil berhasil disimpan.");
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function useCurrentGps() {
    setMessage("");
    setSuccess(false);

    if (!navigator.geolocation) {
      setMessage("Browser ini tidak mendukung GPS.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        updateField("mapsUrl", `https://www.google.com/maps?q=${latitude},${longitude}`);
      },
      () => {
        setMessage("Gagal mengambil titik GPS. Pastikan izin lokasi di browser aktif.");
      },
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fbf7f4] text-slate-950">
        <p className="text-sm font-medium text-slate-600">Memuat profil...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fbf7f4] px-5 py-10 text-slate-950">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-rose-500">Tokoku</p>
            <h1 className="mt-1 text-3xl font-bold">Setting Profil</h1>
          </div>
          <Link href="/" className="rounded-md border border-rose-200 bg-white px-4 py-2 text-sm font-medium">
            Kembali
          </Link>
        </div>

        <form onSubmit={saveProfile} className="rounded-lg border border-rose-100 bg-white p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">
              Nama
              <input
                value={form.fullName}
                onChange={(event) => updateField("fullName", event.target.value)}
                required
                className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-rose-400"
              />
            </label>

            <label className="grid gap-2 text-sm font-medium">
              Username
              <input
                value={form.username}
                onChange={(event) => updateField("username", event.target.value)}
                required
                className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-rose-400"
              />
            </label>

            <label className="grid gap-2 text-sm font-medium">
              Email
              <input
                value={form.email}
                disabled
                className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500 outline-none"
              />
            </label>

            <label className="grid gap-2 text-sm font-medium">
              Nomor WhatsApp
              <input
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
                required
                className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-rose-400"
              />
            </label>

            <label className="grid gap-2 text-sm font-medium sm:col-span-2">
              Alamat
              <textarea
                value={form.address}
                onChange={(event) => updateField("address", event.target.value)}
                required
                rows={4}
                className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-rose-400"
              />
            </label>

            <div className="grid gap-2 text-sm font-medium sm:col-span-2">
              Titik GPS / Google Maps
              <input
                value={form.mapsUrl}
                onChange={(event) => updateField("mapsUrl", event.target.value)}
                placeholder="https://www.google.com/maps?q=..."
                className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-rose-400"
              />
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={useCurrentGps}
                  className="rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700 hover:bg-rose-100"
                >
                  Gunakan Titik GPS Saya
                </button>
                {form.mapsUrl && (
                  <a
                    href={form.mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Buka titik di Google Maps
                  </a>
                )}
              </div>
            </div>
          </div>

          {message && (
            <p className={`mt-4 rounded-md px-3 py-2 text-sm ${success ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
              {message}
            </p>
          )}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button type="submit" disabled={saving} className="rounded-md bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-60">
              {saving ? "Menyimpan..." : "Simpan Profil"}
            </button>
            <button type="button" onClick={logout} className="rounded-md border border-rose-200 bg-white px-5 py-3 text-sm font-bold text-rose-600">
              Logout
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
