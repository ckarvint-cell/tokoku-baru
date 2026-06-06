"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function SignupPage() {
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    email: "",
    phone: "",
    address: "",
    password: "",
    confirmPassword: "",
  });
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  function updateField(name: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setSuccess(false);

    if (form.password !== form.confirmPassword) {
      setLoading(false);
      setMessage("Password dan confirm password harus sama.");
      return;
    }

    const { data: existingUsername } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", form.username)
      .maybeSingle();

    if (existingUsername) {
      setLoading(false);
      setMessage("Username ini sudah digunakan oleh pengguna lain. Silakan gunakan username yang berbeda.");
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.fullName,
          username: form.username,
          phone: form.phone,
          address: form.address,
        },
      },
    });

    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }

    setSuccess(true);
    setMessage("Pendaftaran berhasil. Silakan cek email untuk verifikasi akun.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fbf7f4] px-5 py-10 text-slate-950">
      <form onSubmit={handleSignup} className="w-full max-w-xl rounded-lg border border-rose-100 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.35em] text-rose-500">Tokoku</p>
        <h1 className="mt-2 text-3xl font-bold">Daftar Customer</h1>
        <p className="mt-2 text-sm text-slate-600">Buat akun untuk checkout dan melihat status pesanan.</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">
            Nama
            <input value={form.fullName} onChange={(event) => updateField("fullName", event.target.value)} required className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-rose-400" />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Username
            <input value={form.username} onChange={(event) => updateField("username", event.target.value)} required className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-rose-400" />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Email
            <input type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} required className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-rose-400" />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Nomor WhatsApp
            <input value={form.phone} onChange={(event) => updateField("phone", event.target.value)} required className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-rose-400" />
          </label>
          <label className="grid gap-2 text-sm font-medium sm:col-span-2">
            Alamat
            <textarea value={form.address} onChange={(event) => updateField("address", event.target.value)} required rows={3} className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-rose-400" />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Password
            <input type="password" value={form.password} onChange={(event) => updateField("password", event.target.value)} required className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-rose-400" />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Confirm Password
            <input type="password" value={form.confirmPassword} onChange={(event) => updateField("confirmPassword", event.target.value)} required className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-rose-400" />
          </label>
        </div>

        {message && (
          <p className={`mt-4 rounded-md px-3 py-2 text-sm ${success ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
            {message}
          </p>
        )}

        <button type="submit" disabled={loading} className="mt-5 w-full rounded-md bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
          {loading ? "Memproses..." : "Daftar"}
        </button>

        <p className="mt-5 text-center text-sm text-slate-600">
          Sudah punya akun?{" "}
          <Link href="/login" className="font-bold text-rose-600">
            Login
          </Link>
        </p>
      </form>
    </main>
  );
}
