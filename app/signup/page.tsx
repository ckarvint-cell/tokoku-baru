"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function SignupPage() {
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    email: "",
    phone: "",
    address: "",
    mapsUrl: "",
    password: "",
    confirmPassword: "",
  });
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [duplicateEmail, setDuplicateEmail] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [verificationCooldown, setVerificationCooldown] = useState(0);

  useEffect(() => {
    if (verificationCooldown <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setVerificationCooldown((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [verificationCooldown]);

  function updateField(name: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setSuccess(false);
    setDuplicateEmail(false);

    if (form.password !== form.confirmPassword) {
      setLoading(false);
      setMessage("Password dan confirm password harus sama.");
      return;
    }

    const { data: existingUsername, error: usernameError } = await supabase.rpc("username_exists", {
      username_to_check: form.username,
    });

    if (usernameError) {
      setLoading(false);
      setMessage("Sistem belum bisa mengecek username. Pastikan SQL function username_exists sudah dibuat.");
      return;
    }

    if (existingUsername) {
      setLoading(false);
      setMessage("Username ini sudah digunakan oleh pengguna lain. Silakan gunakan username yang berbeda.");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.fullName,
          username: form.username,
          phone: form.phone,
          address: form.address,
          maps_url: form.mapsUrl,
        },
      },
    });

    setLoading(false);
    if (error) {
      const lowerMessage = error.message.toLowerCase();
      if (lowerMessage.includes("already") || lowerMessage.includes("registered")) {
        setDuplicateEmail(true);
        setMessage("Email ini sudah terdaftar. Jika belum verifikasi, kamu bisa kirim ulang email verifikasi.");
      } else {
        setMessage(error.message);
      }
      return;
    }

    if (data.user && data.user.identities?.length === 0) {
      setDuplicateEmail(true);
      setMessage("Email ini sudah terdaftar. Jika belum verifikasi, kamu bisa kirim ulang email verifikasi.");
      return;
    }

    await supabase.auth.signOut();
    setSuccess(true);
    setMessage("Pendaftaran berhasil. Silakan cek email untuk verifikasi akun.");
  }

  async function resendVerificationEmail() {
    if (verificationCooldown > 0) {
      return;
    }

    if (!form.email) {
      setSuccess(false);
      setMessage("Isi email terlebih dahulu untuk mengirim ulang verifikasi.");
      return;
    }

    setResendingVerification(true);
    setSuccess(false);
    setMessage("");

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: form.email,
      options: {
        emailRedirectTo: `${window.location.origin}/login?verified=1`,
      },
    });

    setResendingVerification(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setDuplicateEmail(false);
    setSuccess(true);
    setVerificationCooldown(60);
    setMessage("Email verifikasi sudah dikirim ulang. Silakan cek inbox atau spam.");
  }

  async function signupWithGoogle() {
    setMessage("");
    setSuccess(false);
    setDuplicateEmail(false);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });

    if (error) {
      setMessage(error.message);
    }
  }

  function useCurrentGps() {
    setMessage("");
    setSuccess(false);
    setDuplicateEmail(false);

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
          <div className={`mt-4 rounded-md px-3 py-2 text-sm ${success ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
            <p>{message}</p>
            {(duplicateEmail || success) && (
              <button
                type="button"
                onClick={resendVerificationEmail}
                disabled={resendingVerification || verificationCooldown > 0}
                className="mt-3 rounded-md bg-white px-3 py-2 text-sm font-bold text-rose-700 ring-1 ring-rose-200 disabled:opacity-60"
              >
                {resendingVerification
                  ? "Mengirim..."
                  : verificationCooldown > 0
                    ? `Tunggu ${verificationCooldown} detik`
                    : "Kirim ulang verifikasi"}
              </button>
            )}
          </div>
        )}

        <button type="submit" disabled={loading} className="mt-5 w-full rounded-md bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
          {loading ? "Memproses..." : "Daftar"}
        </button>

        <button
          type="button"
          onClick={signupWithGoogle}
          className="mt-3 w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900 hover:bg-slate-50"
        >
          Daftar dengan Google
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
