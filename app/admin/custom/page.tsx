"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Profile = {
  email: string;
  role: "customer" | "admin" | "manager";
};

type SiteSettings = {
  store_name: string;
  welcome_template: string;
  welcome_description: string;
};

type PaymentSettings = {
  bank_name: string;
  account_number: string;
  account_holder: string;
  payment_logo_url: string;
  payment_note: string;
};

type FooterSettings = {
  store_name: string;
  address: string;
  whatsapp: string;
  email: string;
  instagram: string;
  copyright_text: string;
};

const defaultSiteSettings: SiteSettings = {
  store_name: "Tokoku",
  welcome_template: "{greeting}, {name}",
  welcome_description: "Pilih koleksi favorit, masukkan ke keranjang, lalu upload bukti transfer saat checkout.",
};

const defaultPaymentSettings: PaymentSettings = {
  bank_name: "",
  account_number: "",
  account_holder: "",
  payment_logo_url: "",
  payment_note: "Transfer sesuai subtotal lalu upload bukti transfer.",
};

const defaultFooterSettings: FooterSettings = {
  store_name: "Tokoku",
  address: "",
  whatsapp: "",
  email: "",
  instagram: "",
  copyright_text: "© Tokoku. All rights reserved.",
};

const PAYMENT_ASSETS_BUCKET = "payment-assets";

export default function AdminCustomPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(defaultSiteSettings);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(defaultPaymentSettings);
  const [footerSettings, setFooterSettings] = useState<FooterSettings>(defaultFooterSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [paymentLogoFile, setPaymentLogoFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function loadPage() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("email, role")
        .eq("id", user.id)
        .single();

      if (!profileData || profileData.role !== "admin") {
        router.push("/");
        return;
      }

      setProfile(profileData);

      const [siteResult, paymentResult, footerResult] = await Promise.all([
        supabase.from("site_settings").select("store_name,welcome_template,welcome_description").eq("id", true).maybeSingle(),
        supabase.from("payment_settings").select("bank_name,account_number,account_holder,payment_logo_url,payment_note").eq("id", true).maybeSingle(),
        supabase.from("footer_settings").select("store_name,address,whatsapp,email,instagram,copyright_text").eq("id", true).maybeSingle(),
      ]);

      if (siteResult.data) setSiteSettings({ ...defaultSiteSettings, ...siteResult.data });
      if (paymentResult.data) setPaymentSettings({ ...defaultPaymentSettings, ...paymentResult.data });
      if (footerResult.data) setFooterSettings({ ...defaultFooterSettings, ...footerResult.data });
      setLoading(false);
    }

    loadPage();
  }, [router]);

  function showResult(ok: boolean, text: string) {
    setSuccess(ok);
    setMessage(text);
  }

  async function saveSiteSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setSaving("site");
    setMessage("");

    const { error } = await supabase.from("site_settings").upsert({ id: true, ...siteSettings });

    setSaving("");
    showResult(!error, error ? error.message : "Welcome text berhasil diedit.");
  }

  async function savePaymentSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setSaving("payment");
    setMessage("");

    let paymentLogoUrl = paymentSettings.payment_logo_url;

    if (paymentLogoFile) {
      const safeName = paymentLogoFile.name.replace(/[^a-zA-Z0-9.-]/g, "-");
      const path = `${Date.now()}-${crypto.randomUUID()}-${safeName}`;

      const { error: uploadError } = await supabase.storage.from(PAYMENT_ASSETS_BUCKET).upload(path, paymentLogoFile, {
        cacheControl: "3600",
        contentType: paymentLogoFile.type,
        upsert: false,
      });

      if (uploadError) {
        setSaving("");
        showResult(false, uploadError.message);
        return;
      }

      const { data } = supabase.storage.from(PAYMENT_ASSETS_BUCKET).getPublicUrl(path);
      paymentLogoUrl = data.publicUrl;
    }

    const payload = { id: true, ...paymentSettings, payment_logo_url: paymentLogoUrl };
    const { error } = await supabase.from("payment_settings").upsert(payload);

    setSaving("");
    if (error) {
      showResult(false, error.message);
      return;
    }

    setPaymentSettings(payload);
    setPaymentLogoFile(null);
    showResult(true, "Checkout payment setting berhasil disimpan.");
  }

  async function saveFooterSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setSaving("footer");
    setMessage("");

    const { error } = await supabase.from("footer_settings").upsert({ id: true, ...footerSettings });

    setSaving("");
    showResult(!error, error ? error.message : "Footer berhasil diedit.");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-950">
        <p className="text-sm font-medium text-slate-600">Memuat custom setting...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{profile?.email}</p>
            <h1 className="mt-1 text-2xl font-bold">Custom / Pengaturan Tampilan & Checkout</h1>
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

      <section className="mx-auto grid max-w-6xl gap-5 px-5 py-8">
        {message && (
          <p className={`rounded-md px-4 py-3 text-sm ${success ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
            {message}
          </p>
        )}

        <form onSubmit={savePaymentSettings} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">Checkout Payment Setting</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">
              Nama Bank
              <input value={paymentSettings.bank_name} onChange={(event) => setPaymentSettings((current) => ({ ...current, bank_name: event.target.value }))} className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-rose-400" />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Nomor Rekening
              <input value={paymentSettings.account_number} onChange={(event) => setPaymentSettings((current) => ({ ...current, account_number: event.target.value }))} className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-rose-400" />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Nama Pemilik Rekening
              <input value={paymentSettings.account_holder} onChange={(event) => setPaymentSettings((current) => ({ ...current, account_holder: event.target.value }))} className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-rose-400" />
            </label>
            <div className="grid gap-2 text-sm font-medium">
              Logo Bank / Pembayaran
              <input
                type="file"
                accept="image/*"
                onChange={(event) => setPaymentLogoFile(event.target.files?.[0] || null)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none file:mr-3 file:rounded-md file:border-0 file:bg-rose-100 file:px-3 file:py-2 file:font-bold file:text-rose-700"
              />
              {paymentLogoFile && <span className="text-xs text-slate-500">File dipilih: {paymentLogoFile.name}</span>}
              {paymentSettings.payment_logo_url && (
                <div className="flex items-center gap-3 rounded-md border border-slate-200 p-3">
                  <img src={paymentSettings.payment_logo_url} alt="Logo pembayaran" className="h-12 w-20 object-contain" />
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentLogoFile(null);
                      setPaymentSettings((current) => ({ ...current, payment_logo_url: "" }));
                    }}
                    className="text-xs font-bold text-rose-600"
                  >
                    Hapus logo
                  </button>
                </div>
              )}
            </div>
            <label className="grid gap-2 text-sm font-medium sm:col-span-2">
              Catatan Pembayaran
              <textarea value={paymentSettings.payment_note} onChange={(event) => setPaymentSettings((current) => ({ ...current, payment_note: event.target.value }))} rows={3} className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-rose-400" />
            </label>
          </div>
          <button type="submit" disabled={saving === "payment"} className="mt-5 rounded-md bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-60">
            {saving === "payment" ? "Menyimpan..." : "Simpan Payment"}
          </button>
        </form>

        <form onSubmit={saveSiteSettings} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">Welcome Text Setting</h2>
          <p className="mt-2 text-sm text-slate-500">Gunakan {"{greeting}"} untuk pagi/siang/sore/malam dan {"{name}"} untuk nama user.</p>
          <div className="mt-5 grid gap-4">
            <label className="grid gap-2 text-sm font-medium">
              Nama Toko
              <input value={siteSettings.store_name} onChange={(event) => setSiteSettings((current) => ({ ...current, store_name: event.target.value }))} className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-rose-400" />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Template Ucapan
              <input value={siteSettings.welcome_template} onChange={(event) => setSiteSettings((current) => ({ ...current, welcome_template: event.target.value }))} className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-rose-400" />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Kata Sambutan Toko
              <textarea value={siteSettings.welcome_description} onChange={(event) => setSiteSettings((current) => ({ ...current, welcome_description: event.target.value }))} rows={3} className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-rose-400" />
            </label>
          </div>
          <button type="submit" disabled={saving === "site"} className="mt-5 rounded-md bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-60">
            {saving === "site" ? "Menyimpan..." : "Simpan Welcome"}
          </button>
        </form>

        <form onSubmit={saveFooterSettings} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">Footer Setting</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">
              Nama Toko
              <input value={footerSettings.store_name} onChange={(event) => setFooterSettings((current) => ({ ...current, store_name: event.target.value }))} className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-rose-400" />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Nomor WhatsApp
              <input value={footerSettings.whatsapp} onChange={(event) => setFooterSettings((current) => ({ ...current, whatsapp: event.target.value }))} className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-rose-400" />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Email
              <input value={footerSettings.email} onChange={(event) => setFooterSettings((current) => ({ ...current, email: event.target.value }))} className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-rose-400" />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Instagram / Sosial Media
              <input value={footerSettings.instagram} onChange={(event) => setFooterSettings((current) => ({ ...current, instagram: event.target.value }))} placeholder="@tokoku atau URL" className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-rose-400" />
            </label>
            <label className="grid gap-2 text-sm font-medium sm:col-span-2">
              Alamat
              <textarea value={footerSettings.address} onChange={(event) => setFooterSettings((current) => ({ ...current, address: event.target.value }))} rows={3} className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-rose-400" />
            </label>
            <label className="grid gap-2 text-sm font-medium sm:col-span-2">
              Copyright Text
              <input value={footerSettings.copyright_text} onChange={(event) => setFooterSettings((current) => ({ ...current, copyright_text: event.target.value }))} className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-rose-400" />
            </label>
          </div>
          <button type="submit" disabled={saving === "footer"} className="mt-5 rounded-md bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-60">
            {saving === "footer" ? "Menyimpan..." : "Simpan Footer"}
          </button>
        </form>
      </section>
    </main>
  );
}
