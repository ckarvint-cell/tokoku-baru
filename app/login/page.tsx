"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }

    if (!data.user?.email_confirmed_at) {
      await supabase.auth.signOut();
      setMessage("Email belum diverifikasi. Silakan cek email dan klik link verifikasi terlebih dahulu.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  async function loginWithGoogle() {
    setMessage("");

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

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fbf7f4] px-5 py-10 text-slate-950">
      <form onSubmit={handleLogin} className="w-full max-w-md rounded-lg border border-rose-100 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.35em] text-rose-500">Tokoku</p>
        <h1 className="mt-2 text-3xl font-bold">Login</h1>
        <p className="mt-2 text-sm text-slate-600">Masuk untuk belanja atau mengelola toko.</p>

        <label className="mt-6 grid gap-2 text-sm font-medium">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-rose-400"
          />
        </label>

        <label className="mt-4 grid gap-2 text-sm font-medium">
          Password
          <div className="flex rounded-md border border-slate-300 focus-within:border-rose-400">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="min-w-0 flex-1 rounded-l-md px-3 py-2 outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="px-3 text-sm font-medium text-rose-600"
            >
              {showPassword ? "Sembunyi" : "Lihat"}
            </button>
          </div>
        </label>

        {message && <p className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{message}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-5 w-full rounded-md bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {loading ? "Memproses..." : "Login"}
        </button>

        <button
          type="button"
          onClick={loginWithGoogle}
          className="mt-3 w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900 hover:bg-slate-50"
        >
          Login dengan Google
        </button>

        <p className="mt-5 text-center text-sm text-slate-600">
          Belum punya akun?{" "}
          <Link href="/signup" className="font-bold text-rose-600">
            Daftar customer
          </Link>
        </p>
      </form>
    </main>
  );
}
