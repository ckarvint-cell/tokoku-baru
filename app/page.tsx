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
  total_dibeli: number;
  image_urls: string[];
};

type CartItem = Product & {
  qty: number;
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

function ProductCard({ product, onAddToCart }: { product: Product; onAddToCart: (product: Product) => void }) {
  const [imageIndex, setImageIndex] = useState(0);
  const images = product.image_urls?.length ? product.image_urls : [];
  const currentImage = images[imageIndex];
  const finalPrice = getDiscountedPrice(Number(product.harga), product.harga_diskon);

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
          <div className="grid gap-1 text-right">
            <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">Stok {product.stok}</span>
            <span className="text-xs font-medium text-slate-400">Terjual {product.total_dibeli || 0}</span>
          </div>
        </div>
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{product.deskripsi || "Belum ada deskripsi."}</p>
        <div className="mt-5 flex items-end justify-between gap-3">
          <div>
            <p className="text-lg font-bold"><span className="text-[0.5em] align-super">Rp</span> {finalPrice.toLocaleString("id-ID")}</p>
            {product.harga_diskon && (
              <p className="text-sm text-slate-400">
                <span className="text-[0.5em] align-middle">Rp</span> <span className="line-through decoration-slate-400 decoration-1">{Number(product.harga).toLocaleString("id-ID")}</span>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onAddToCart(product)}
            className="rounded-md bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-rose-600"
          >
            Keranjang
          </button>
        </div>
      </div>
    </article>
  );
}

function CartPanel({
  cart,
  onClose,
  onIncrease,
  onDecrease,
  onRemove,
}: {
  cart: CartItem[];
  onClose: () => void;
  onIncrease: (productId: string) => void;
  onDecrease: (productId: string) => void;
  onRemove: (productId: string) => void;
}) {
  const subtotal = cart.reduce((total, item) => total + getDiscountedPrice(Number(item.harga), item.harga_diskon) * item.qty, 0);
  const totalQty = cart.reduce((total, item) => total + item.qty, 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40 px-4 py-5 backdrop-blur-sm" onClick={onClose}>
      <aside
        className="ml-auto flex h-full w-full max-w-md flex-col rounded-lg bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-rose-100 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-rose-500">Keranjang</p>
              <h2 className="mt-1 text-2xl font-bold">Pembelian</h2>
              <p className="mt-1 text-sm text-slate-500">{totalQty} item dipilih</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
            >
              Tutup
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {cart.length === 0 ? (
            <div className="rounded-lg border border-dashed border-rose-200 bg-rose-50 px-4 py-8 text-center text-sm text-slate-600">
              Keranjang masih kosong. Pilih produk favorit dari katalog.
            </div>
          ) : (
            <div className="grid gap-3">
              {cart.map((item) => {
                const itemPrice = getDiscountedPrice(Number(item.harga), item.harga_diskon);
                const firstImage = item.image_urls?.[0];

                return (
                  <div key={item.id} className="grid grid-cols-[76px_1fr] gap-3 rounded-lg border border-rose-100 p-3">
                    <div className="aspect-square overflow-hidden rounded-md bg-rose-50">
                      {firstImage ? (
                        <img src={firstImage} alt={item.nama_produk} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center px-2 text-center text-xs text-slate-400">No foto</div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-bold">{item.nama_produk}</h3>
                          <p className="mt-1 text-xs text-slate-500">{item.kategori || "Tanpa kategori"}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemove(item.id)}
                          className="text-xs font-bold text-rose-600 hover:text-rose-700"
                        >
                          Hapus
                        </button>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <p className="text-sm font-bold">
                          <span className="text-[0.65em] align-super">Rp</span> {itemPrice.toLocaleString("id-ID")}
                        </p>
                        <div className="flex items-center rounded-md border border-slate-200">
                          <button
                            type="button"
                            onClick={() => onDecrease(item.id)}
                            className="h-8 w-8 text-lg font-bold text-slate-600"
                            aria-label={`Kurangi ${item.nama_produk}`}
                          >
                            -
                          </button>
                          <span className="w-8 text-center text-sm font-bold">{item.qty}</span>
                          <button
                            type="button"
                            onClick={() => onIncrease(item.id)}
                            className="h-8 w-8 text-lg font-bold text-slate-600"
                            aria-label={`Tambah ${item.nama_produk}`}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-rose-100 px-5 py-4">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>Subtotal</span>
            <strong className="text-lg text-slate-950">
              <span className="text-[0.6em] align-super">Rp</span> {subtotal.toLocaleString("id-ID")}
            </strong>
          </div>
          <button
            type="button"
            disabled={cart.length === 0}
            className="mt-4 w-full rounded-md bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            Lanjut Checkout
          </button>
        </div>
      </aside>
    </div>
  );
}

export default function Home() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [now, setNow] = useState(new Date());
  const [notice, setNotice] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

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
        .select("id,nama_produk,kategori,deskripsi,harga,harga_diskon,stok,total_dibeli,image_urls")
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

  function addToCart(product: Product) {
    setCart((current) => {
      const existingItem = current.find((item) => item.id === product.id);

      if (existingItem) {
        return current.map((item) => (item.id === product.id ? { ...item, qty: Math.min(item.qty + 1, item.stok) } : item));
      }

      return [...current, { ...product, qty: 1 }];
    });
    setCartOpen(true);
  }

  function increaseCartQty(productId: string) {
    setCart((current) =>
      current.map((item) => (item.id === productId ? { ...item, qty: Math.min(item.qty + 1, item.stok) } : item)),
    );
  }

  function decreaseCartQty(productId: string) {
    setCart((current) =>
      current
        .map((item) => (item.id === productId ? { ...item, qty: item.qty - 1 } : item))
        .filter((item) => item.qty > 0),
    );
  }

  function removeFromCart(productId: string) {
    setCart((current) => current.filter((item) => item.id !== productId));
  }

  const name = profile?.full_name || "Pengunjung";
  const cartQty = cart.reduce((total, item) => total + item.qty, 0);

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
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white"
            >
              Keranjang ({cartQty})
            </button>
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
              <ProductCard key={product.id} product={product} onAddToCart={addToCart} />
            ))}
          </div>

          {products.length === 0 && (
            <div className="mt-6 rounded-lg border border-dashed border-rose-200 bg-white px-5 py-10 text-center text-sm text-slate-500">
              Belum ada produk aktif. Tambahkan produk dari halaman admin.
            </div>
          )}
        </section>
      </section>

      {cartOpen && (
        <CartPanel
          cart={cart}
          onClose={() => setCartOpen(false)}
          onIncrease={increaseCartQty}
          onDecrease={decreaseCartQty}
          onRemove={removeFromCart}
        />
      )}
    </main>
  );
}
