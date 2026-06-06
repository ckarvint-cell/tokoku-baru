"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Profile = {
  full_name: string | null;
  role: "customer" | "admin" | "manager";
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 11) return "Selamat Pagi";
  if (hour < 15) return "Selamat Siang";
  if (hour < 18) return "Selamat Sore";
  return "Selamat Malam";
}

export default function Home() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [now, setNow] = useState(new Date());
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    async function loadProfile() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      const returnedFromEmailLink =
        window.location.hash.includes("access_token") ||
        window.location.hash.includes("type=signup") ||
        window.location.search.includes("code=");

      if (!user) {
        if (returnedFromEmailLink) {
          setNotice("Verifikasi sedang diproses. Silakan login setelah beberapa detik.");
          window.history.replaceState(null, "", window.location.pathname);
        }
        return;
      }

      if (returnedFromEmailLink && user.email_confirmed_at) {
        setNotice("Email berhasil diverifikasi. Akun Anda sudah aktif.");
        window.history.replaceState(null, "", window.location.pathname);
      }

      const { data } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .single();

      setProfile(data);
    }

    loadProfile();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    setProfile(null);
  }

  const name = profile?.full_name || "Pengunjung";

  return (
    <main className="min-h-screen bg-[#fbf7f4] text-slate-950">
      <header className="border-b border-rose-100 bg-white/90">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-rose-500">Tokoku</p>
            <h1 className="mt-1 text-2xl font-bold">Katalog Produk</h1>
          </div>
          <nav className="flex flex-wrap gap-2">
            {profile && (
              <Link href="/orders" className="rounded-md border border-rose-200 px-4 py-2 text-sm font-medium">
                Daftar Pesanan
              </Link>
            )}
            {profile && (
              <Link href="/settings" className="rounded-md border border-rose-200 px-4 py-2 text-sm font-medium">
                Setting
              </Link>
            )}
            {profile?.role === "admin" && (
              <Link href="/admin" className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white">
                Admin
              </Link>
            )}
            {profile ? (
              <button onClick={logout} className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white">
                Logout
              </button>
            ) : (
              <>
                <Link href="/login" className="rounded-md border border-rose-200 px-4 py-2 text-sm font-medium">
                  Login
                </Link>
                <Link href="/signup" className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white">
                  Daftar
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-10">
        {notice && (
          <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            {notice}
          </div>
        )}

        <div className="grid gap-6 rounded-lg border border-rose-100 bg-white p-6 shadow-sm md:grid-cols-[1fr_280px] md:p-8">
          <div>
            <p className="text-sm font-medium text-rose-600">
              {now.toLocaleDateString("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
            <h2 className="mt-4 text-3xl font-bold md:text-4xl">
              {getGreeting()}, {name}
            </h2>
            <p className="mt-4 max-w-2xl text-slate-600">
              Website toko online baru sudah terhubung ke Supabase. Berikutnya kita akan isi produk,
              keranjang, checkout, dan dashboard admin.
            </p>
          </div>
          <div className="flex items-center justify-center rounded-lg bg-rose-50 p-6">
            <div className="rounded-lg bg-white px-8 py-6 text-center shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.35em] text-slate-500">Jam</p>
              <p className="mt-3 text-4xl font-bold">
                {now.toLocaleTimeString("id-ID", { hour12: false })}
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
