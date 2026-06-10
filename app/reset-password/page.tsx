"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("Memeriksa link reset password...");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  useEffect(() => {
    async function prepareRecoverySession() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const urlError = url.searchParams.get("error_description") || url.searchParams.get("error");
      const hashParams = new URLSearchParams(window.location.hash.replace("#", ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (urlError) {
        setMessage(`Link reset password bermasalah: ${urlError}. Kirim ulang link reset dari halaman login.`);
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          setMessage("Link reset password tidak valid atau sudah kedaluwarsa. Kirim ulang link reset dari halaman login.");
          return;
        }

        window.history.replaceState({}, "", "/reset-password");
      }

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          setMessage("Link reset password tidak valid atau sudah kedaluwarsa. Kirim ulang link reset dari halaman login.");
          return;
        }

        window.history.replaceState({}, "", "/reset-password");
      }

      const { data } = await supabase.auth.getSession();

      if (data.session) {
        setHasRecoverySession(true);
        setMessage("");
        return;
      }

      setMessage("Buka halaman ini dari link reset password yang dikirim ke email.");
    }

    prepareRecoverySession();
  }, []);

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess(false);
    setMessage("");

    if (password !== confirmPassword) {
      setMessage("Password dan confirm password harus sama.");
      return;
    }

    if (password.length < 6) {
      setMessage("Password minimal 6 karakter.");
      return;
    }

    if (!hasRecoverySession) {
      setMessage("Session reset password belum aktif. Buka link reset langsung dari email terbaru, jangan ketik URL manual.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setLoading(false);
      setMessage(error.message);
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.access_token) {
      await fetch("/api/password-audit", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
    }

    setLoading(false);
    await supabase.auth.signOut();
    setSuccess(true);
    setMessage("Password berhasil diubah dan sudah diverifikasi. Silakan login dengan password baru.");
    setPassword("");
    setConfirmPassword("");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fbf7f4] px-5 py-10 text-slate-950">
      <form onSubmit={handleResetPassword} className="w-full max-w-md rounded-lg border border-rose-100 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.35em] text-rose-500">Tokoku</p>
        <h1 className="mt-2 text-3xl font-bold">Reset Password</h1>
        <p className="mt-2 text-sm text-slate-600">Buat password baru untuk akun customer.</p>

        <label className="mt-6 grid gap-2 text-sm font-medium">
          Password Baru
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            disabled={loading}
            className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-rose-400 disabled:bg-slate-100"
          />
        </label>

        <label className="mt-4 grid gap-2 text-sm font-medium">
          Confirm Password
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            disabled={loading}
            className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-rose-400 disabled:bg-slate-100"
          />
        </label>

        {message && (
          <p className={`mt-4 rounded-md px-3 py-2 text-sm ${success ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-5 w-full rounded-md bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {loading ? "Menyimpan..." : "Simpan Password Baru"}
        </button>

        <p className="mt-5 text-center text-sm text-slate-600">
          Sudah ingat password?{" "}
          <Link href="/login" className="font-bold text-rose-600">
            Login
          </Link>
        </p>
      </form>
    </main>
  );
}
