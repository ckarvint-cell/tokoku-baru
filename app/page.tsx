"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Profile = {
  full_name: string | null;
  role: "customer" | "admin" | "manager";
};

type Product = {
  id: string;
  nama_produk: string;
  kategori: string | null;
  deskripsi: string | null;
  harga: number;
  harga_diskon: number | null;
  stok: number;
  image_urls: string[];
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 11) return "Selamat Pagi";
  if (hour < 15) return "Selamat Siang";
  if (hour < 18) return "Selamat Sore";
  return "Selamat Malam";
}

function getDiscountedPrice(price: number, discountPercent: number | null) {
  if (!discountPercent) return price;
  return price - price * (discountPercent / 100);
}

function ProductCard({ product }: { product: Product }) {
  const [imageIndex, setImageIndex] = useState(0);
  const images = product.image_urls?.length ? product.image_urls : [];
  const currentImage = images[imageIndex];
  const finalPrice = getDiscountedPrice(Number(product.harga), product.harga_diskon);

  useEffect(() => {
    if (images.length <= 1) return;

    const timer = window.setInterval(() => {
      setImageIndex((current) => (current + 1) % images.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [images.length]);

  function previousImage() {
    if (images.length <= 1) return;
    setImageIndex((current) => (current - 1 + images.length) % images.length);
  }

  function nextImage() {
    if (images.length <= 1) return;
    setImageIndex((current) => (current + 1) % images.length);
  }

  return (
    <article className="overflow-hidden rounded-lg border border-rose-100 bg-white shadow-sm">
      <div className="relative aspect-[4/3] bg-rose-50">
        {currentImage ? (
          <img src={currentImage} alt={product.nama_produk} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">Belum ada foto</div>
        )}

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={previousImage}
              className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl font-bold shadow-sm"
              aria-label="Foto sebelumnya"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={nextImage}
              className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl font-bold shadow-sm"
              aria-label="Foto berikutnya"
            >
              ›
            </button>
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
              {images.map((image, index) => (
                <button
                  key={image}
                  type="button"
                  onClick={() => setImageIndex(index)}
                  className={`h-2 w-2 rounded-full ${index === imageIndex ? "bg-white" : "bg-white/50"}`}
                  aria-label={`Lihat foto ${index + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">{product.nama_produk}</h3>
            <p className="mt-1 text-sm text-slate-500">{product.kategori || "Tanpa kategori"}</p>
          </div>
          <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">Stok {product.stok}</span>
        </div>
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{product.deskripsi || "Belum ada deskripsi."}</p>
        <div className="mt-5 flex items-end justify-between gap-3">
          <div>
            <p className="text-lg font-bold">Rp {finalPrice.toLocaleString("id-ID")}</p>
            {product.harga_diskon && (
              <p className="text-sm text-slate-400">
                <span className="line-through">Rp {Number(product.harga).toLocaleString("id-ID")}</span> Diskon {product.harga_diskon}%
              </p>
            )}
          </div>
          <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-bold text-white">
            Keranjang
          </button>
        </div>
      </div>
    </article>
  );
}

export default function Home() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
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

  useEffect(() => {
    async function loadProducts() {
      const { data } = await supabase
        .from("products")
        .select("id,nama_produk,kategori,deskripsi,harga,harga_diskon,stok,image_urls")
        .eq("aktif", true)
        .order("created_at", { ascending: false });

      if (data) {
        setProducts(data as Product[]);
      }
    }

    loadProducts();
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

        <section className="mt-10">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.35em] text-rose-500">Koleksi</p>
              <h2 className="mt-1 text-2xl font-bold">Produk Tersedia</h2>
            </div>
            <p className="text-sm text-slate-500">Produk dari dashboard admin akan tampil di sini.</p>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {products.length === 0 && (
            <div className="mt-6 rounded-lg border border-dashed border-rose-200 bg-white px-5 py-10 text-center text-sm text-slate-500">
              Belum ada produk aktif. Tambahkan produk dari halaman admin.
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
