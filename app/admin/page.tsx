"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Profile = {
  full_name: string | null;
  email: string;
  role: "customer" | "admin" | "manager";
};

const adminMenus = [
  { title: "Produk", description: "Tambah, edit, stok, diskon, dan foto produk.", href: "/admin/products" },
  { title: "Customer", description: "Lihat data customer dan status akun.", href: "/admin/customers" },
  { title: "Pesanan", description: "Approve pembayaran, tolak, input resi, update status.", href: "/admin/orders" },
  { title: "Voucher", description: "Buat kode promo dan atur masa berlaku.", href: "/admin/vouchers" },
  { title: "Keuangan", description: "Ringkasan transaksi, diskon, ongkir, dan penjualan.", href: "/admin/finance" },
  { title: "Custom", description: "Atur tampilan website, rekening checkout, welcome text, dan footer.", href: "/admin/custom" },
  { title: "Setting", description: "Atur rekening, WhatsApp toko, bahasa, dan akses.", href: "/admin/settings" },
];

export default function AdminPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    async function checkAccess() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        router.push("/login");
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("full_name, email, role")
        .eq("id", user.id)
        .single();

      if (!data || !["admin", "manager"].includes(data.role)) {
        router.push("/");
        return;
      }

      setProfile(data);
      setLoading(false);
    }

    checkAccess();
  }, [router]);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-950">
        <p className="text-sm font-medium text-slate-600">Memeriksa akses admin...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      {panelOpen && (
        <button
          type="button"
          aria-label="Tutup panel admin"
          onClick={() => setPanelOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/35 lg:hidden"
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-slate-200 bg-white p-5 shadow-xl transition-transform duration-200 lg:translate-x-0 lg:shadow-none ${panelOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between gap-3">
          <Link href="/" onClick={() => setPanelOpen(false)} className="inline-block text-xs font-bold uppercase tracking-[0.35em] text-rose-500 hover:text-rose-600">
            Tokoku
          </Link>
          <button
            type="button"
            onClick={() => setPanelOpen(false)}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600 lg:hidden"
          >
            Tutup
          </button>
        </div>
        <h1 className="mt-2 text-2xl font-bold">Admin Panel</h1>
        <nav className="mt-8 grid gap-2">
          <Link href="/admin" onClick={() => setPanelOpen(false)} className="rounded-md bg-slate-950 px-4 py-3 text-sm font-bold text-white">
            Dashboard
          </Link>
          {adminMenus.map((menu) => (
            <Link key={menu.href} href={menu.href} onClick={() => setPanelOpen(false)} className="rounded-md px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100">
              {menu.title}
            </Link>
          ))}
        </nav>
      </aside>

      <section className="lg:pl-64">
        <header className="border-b border-slate-200 bg-white">
          <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Buka panel admin"
                onClick={() => setPanelOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 shadow-sm lg:hidden"
              >
                <span className="grid gap-1">
                  <span className="block h-0.5 w-4 rounded bg-slate-700" />
                  <span className="block h-0.5 w-4 rounded bg-slate-700" />
                  <span className="block h-0.5 w-4 rounded bg-slate-700" />
                </span>
              </button>
              <div>
                <p className="text-sm font-medium text-slate-500">{profile?.email}</p>
                <h2 className="mt-1 text-2xl font-bold">Dashboard Admin</h2>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium">
                Lihat Website
              </Link>
              <button onClick={logout} className="rounded-md bg-rose-600 px-4 py-2 text-sm font-bold text-white">
                Logout
              </button>
            </div>
          </div>
        </header>

        <div className="px-5 py-8 lg:px-8">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <div className="rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <p className="text-[11px] font-semibold leading-tight text-slate-500">Role</p>
              <p className="mt-1 text-xl font-bold leading-none capitalize">{profile?.role}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <p className="text-[11px] font-semibold leading-tight text-slate-500">Total Pesanan</p>
              <p className="mt-1 text-xl font-bold leading-none">0</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <p className="text-[11px] font-semibold leading-tight text-slate-500">Total Produk</p>
              <p className="mt-1 text-xl font-bold leading-none">0</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <p className="text-[11px] font-semibold leading-tight text-slate-500">Pembayaran Menunggu</p>
              <p className="mt-1 text-xl font-bold leading-none">0</p>
            </div>
          </div>

          <section className="mt-8">
            <h3 className="text-xl font-bold">Menu Pengelolaan</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {adminMenus.map((menu) => (
                <Link key={menu.href} href={menu.href} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <h4 className="text-lg font-bold">{menu.title}</h4>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{menu.description}</p>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
