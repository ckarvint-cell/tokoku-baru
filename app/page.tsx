"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Profile = {
  full_name: string | null;
  phone: string | null;
  address: string | null;
  maps_url: string | null;
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
  note: string;
};

type CheckoutForm = {
  name: string;
  phone: string;
  address: string;
  mapsUrl: string;
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
  payment_note: "",
};

const officialPaymentWarning =
  "Transfer hanya dilakukan ke rekening resmi di bawah ini setelah ongkir ditentukan dan Grand Total tampil di Daftar Pesanan. Pembayaran di luar rekening resmi toko tidak menjadi tanggung jawab kami. Terima kasih atas pengertiannya.";

const PRODUCTS_PER_PAGE = 40;

const defaultFooterSettings: FooterSettings = {
  store_name: "Tokoku",
  address: "",
  whatsapp: "",
  email: "",
  instagram: "",
  copyright_text: "© Tokoku. All rights reserved.",
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

function formatWelcome(template: string, greeting: string, name: string) {
  return (template || defaultSiteSettings.welcome_template)
    .replaceAll("{greeting}", greeting)
    .replaceAll("{name}", name);
}

function getMissingColumn(errorMessage: string | undefined) {
  return errorMessage?.match(/Could not find the '([^']+)' column/)?.[1] || "";
}

function getRequiredColumn(errorMessage: string | undefined) {
  return errorMessage?.match(/null value in column "([^"]+)"/)?.[1] || "";
}

function isStatusConstraintError(errorMessage: string | undefined) {
  return Boolean(errorMessage?.includes("orders_status_check"));
}

function getOrderFallbackValue(column: string, userId: string, email: string, form: CheckoutForm, totalProduk: number) {
  const normalized = column.toLowerCase();

  if (normalized === "id") return crypto.randomUUID();
  if (normalized.includes("email")) return email;
  if (normalized.includes("user") || normalized.includes("customer") || normalized.includes("pelanggan")) {
    if (normalized.includes("nama") || normalized.includes("name")) return form.name;
    if (normalized.includes("phone") || normalized.includes("whatsapp") || normalized.includes("telepon") || normalized.includes("hp")) return form.phone;
    if (normalized.includes("alamat") || normalized.includes("address")) return form.address;
    return userId;
  }
  if (normalized.includes("nama") || normalized.includes("penerima") || normalized.includes("name")) return form.name;
  if (normalized.includes("phone") || normalized.includes("whatsapp") || normalized.includes("telepon") || normalized.includes("hp")) return form.phone;
  if (normalized.includes("alamat") || normalized.includes("address")) return form.address;
  if (normalized.includes("maps") || normalized.includes("map") || normalized.includes("gps") || normalized.includes("lokasi")) return form.mapsUrl || "";
  if (normalized.includes("ongkir") || normalized.includes("shipping")) return 0;
  if (normalized.includes("total") || normalized.includes("harga") || normalized.includes("bayar") || normalized.includes("grand")) return totalProduk;
  if (normalized.includes("status")) return "Menunggu Ongkir";
  if (normalized.includes("tanggal") || normalized.includes("date") || normalized.includes("time")) return new Date().toISOString();

  return "";
}

function getOrderItemFallbackValue(column: string, item: CartItem) {
  const normalized = column.toLowerCase();
  const price = getDiscountedPrice(Number(item.harga), item.harga_diskon);
  const subtotal = price * item.qty;

  if (normalized === "id") return crypto.randomUUID();
  if (normalized.includes("produk") || normalized.includes("product")) {
    if (normalized.includes("nama") || normalized.includes("name")) return item.nama_produk;
    return item.id;
  }
  if (normalized.includes("nama") || normalized.includes("name")) return item.nama_produk;
  if (normalized.includes("qty") || normalized.includes("jumlah")) return item.qty;
  if (normalized.includes("harga") || normalized.includes("price")) return price;
  if (normalized.includes("subtotal") || normalized.includes("total")) return subtotal;
  if (normalized.includes("note") || normalized.includes("catatan")) return item.note || "";
  if (normalized.includes("tanggal") || normalized.includes("date") || normalized.includes("time")) return new Date().toISOString();

  return "";
}

function attachItemNoteFallback(name: string, note: string) {
  const cleanNote = note.trim();
  if (name.includes("||CATATAN:")) return name;
  return cleanNote ? `${name} ||CATATAN:${cleanNote}` : name;
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
      <div className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-sm font-bold sm:text-base">{product.nama_produk}</h3>
            <p className="mt-1 truncate text-xs text-slate-500 sm:text-sm">{product.kategori || "Tanpa kategori"}</p>
          </div>
          <div className="grid gap-1 text-right">
            <span className="rounded-full bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700 sm:text-xs">Stok {product.stok}</span>
            <span className="text-[10px] font-medium text-slate-400 sm:text-xs">Terjual {product.total_dibeli || 0}</span>
          </div>
        </div>
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600 sm:text-sm">{product.deskripsi || "Belum ada deskripsi."}</p>
        <div className="mt-4 grid gap-3 sm:flex sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold sm:text-base"><span className="text-[0.5em] align-super">Rp</span> {finalPrice.toLocaleString("id-ID")}</p>
            {product.harga_diskon && (
              <p className="text-xs text-slate-400">
                <span className="text-[0.5em] align-middle">Rp</span> <span className="line-through decoration-slate-400 decoration-1">{Number(product.harga).toLocaleString("id-ID")}</span>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onAddToCart(product)}
            className="rounded-md bg-slate-950 px-3 py-2 text-xs font-bold text-white hover:bg-rose-600 sm:text-sm"
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
  onCheckout,
  onUpdateNote,
}: {
  cart: CartItem[];
  onClose: () => void;
  onIncrease: (productId: string) => void;
  onDecrease: (productId: string) => void;
  onRemove: (productId: string) => void;
  onCheckout: () => void;
  onUpdateNote: (productId: string, note: string) => void;
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

                      <label className="mt-3 grid gap-1 text-xs font-medium text-slate-500">
                        Catatan produk
                        <textarea
                          value={item.note}
                          onChange={(event) => onUpdateNote(item.id, event.target.value)}
                          rows={2}
                          placeholder="Contoh: warna, ukuran, atau request khusus"
                          className="resize-none rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-rose-400"
                        />
                      </label>
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
            onClick={onCheckout}
            className="mt-4 w-full rounded-md bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            Lanjut Checkout
          </button>
        </div>
      </aside>
    </div>
  );
}

function CheckoutPanel({
  cart,
  form,
  confirming,
  checkoutError,
  submitting,
  paymentSettings,
  onClose,
  onBackToCart,
  onChange,
  onUseGps,
  onSubmit,
  onConfirm,
  onCancelConfirm,
}: {
  cart: CartItem[];
  form: CheckoutForm;
  confirming: boolean;
  checkoutError: string;
  submitting: boolean;
  paymentSettings: PaymentSettings;
  onClose: () => void;
  onBackToCart: () => void;
  onChange: (name: keyof CheckoutForm, value: string) => void;
  onUseGps: () => void;
  onSubmit: () => void;
  onConfirm: () => void;
  onCancelConfirm: () => void;
}) {
  const subtotal = cart.reduce((total, item) => total + getDiscountedPrice(Number(item.harga), item.harga_diskon) * item.qty, 0);
  const totalQty = cart.reduce((total, item) => total + item.qty, 0);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 px-4 py-5 backdrop-blur-sm" onClick={onClose}>
      <section
        className="mx-auto w-full max-w-2xl rounded-lg bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-rose-100 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-rose-500">Checkout</p>
              <h2 className="mt-1 text-2xl font-bold">Konfirmasi Pembelian</h2>
              <p className="mt-1 text-sm text-slate-500">{totalQty} item, subtotal Rp {subtotal.toLocaleString("id-ID")}</p>
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

        <div className="grid gap-5 px-5 py-5">
          <div className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-slate-900">Ringkasan Produk</p>
              <p className="text-sm font-bold text-slate-900">{totalQty} item</p>
            </div>
            <div className="mt-3 grid gap-2">
              {cart.map((item) => (
                <div key={item.id} className="grid gap-1 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-slate-600">{item.nama_produk} x {item.qty}</span>
                    <strong>Rp {(getDiscountedPrice(Number(item.harga), item.harga_diskon) * item.qty).toLocaleString("id-ID")}</strong>
                  </div>
                  <p className="text-xs text-slate-500">
                    Harga satuan Rp {getDiscountedPrice(Number(item.harga), item.harga_diskon).toLocaleString("id-ID")}
                  </p>
                  {item.note && <p className="text-xs leading-5 text-slate-500">Catatan: {item.note}</p>}
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-rose-200 pt-3 text-base">
              <span className="font-bold text-slate-700">Total Produk</span>
              <strong>Rp {subtotal.toLocaleString("id-ID")}</strong>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white px-4 py-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-rose-500">Rekening Pembayaran Resmi</p>
                <h3 className="mt-2 text-lg font-bold">{paymentSettings.bank_name || "Bank belum diatur"}</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Nomor rekening: <span className="font-bold text-slate-950">{paymentSettings.account_number || "-"}</span>
                </p>
                <p className="text-sm text-slate-600">
                  Atas nama: <span className="font-bold text-slate-950">{paymentSettings.account_holder || "-"}</span>
                </p>
              </div>
              {paymentSettings.payment_logo_url && (
                <img
                  src={paymentSettings.payment_logo_url}
                  alt={paymentSettings.bank_name || "Logo pembayaran"}
                  className="h-14 w-24 rounded-md border border-slate-100 object-contain p-2"
                />
              )}
            </div>
            <p className="mt-3 rounded-md bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-800">
              {officialPaymentWarning}
            </p>
          </div>

          {checkoutError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {checkoutError}
            </div>
          )}

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4">
            <p className="text-sm font-bold text-amber-950">Ongkir akan dihitung admin.</p>
            <p className="mt-2 text-sm leading-6 text-amber-800">
              Setelah pesanan dibuat, status masuk ke Daftar Pesanan sebagai Menunggu Ongkir. Bukti pembayaran baru bisa diupload setelah ongkir ditentukan.
            </p>
          </div>

          {confirming ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4">
              <h3 className="text-lg font-bold text-emerald-900">Buat pesanan sekarang?</h3>
              <p className="mt-2 text-sm leading-6 text-emerald-800">
                Pastikan alamat, nomor WhatsApp, dan titik maps sudah benar. Pesanan akan masuk ke admin untuk dihitung ongkir.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={submitting}
                  className="rounded-md bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {submitting ? "Membuat Pesanan..." : "Ya, Buat Pesanan"}
                </button>
                <button
                  type="button"
                  onClick={onCancelConfirm}
                  disabled={submitting}
                  className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700"
                >
                  Tidak, Cek Lagi
                </button>
              </div>
            </div>
          ) : (
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                onSubmit();
              }}
            >
              <label className="grid gap-2 text-sm font-medium">
                Nama Penerima
                <input
                  value={form.name}
                  onChange={(event) => onChange("name", event.target.value)}
                  required
                  className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-rose-400"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Nomor WhatsApp
                <input
                  value={form.phone}
                  onChange={(event) => onChange("phone", event.target.value)}
                  required
                  className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-rose-400"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium sm:col-span-2">
                Alamat Pengiriman
                <textarea
                  value={form.address}
                  onChange={(event) => onChange("address", event.target.value)}
                  required
                  rows={3}
                  className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-rose-400"
                />
              </label>
              <div className="grid gap-2 text-sm font-medium sm:col-span-2">
                Titik GPS / Google Maps
                <input
                  value={form.mapsUrl}
                  onChange={(event) => onChange("mapsUrl", event.target.value)}
                  placeholder="https://www.google.com/maps?q=..."
                  className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-rose-400"
                />
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={onUseGps}
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
              <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row">
                <button type="submit" className="rounded-md bg-slate-950 px-4 py-3 text-sm font-bold text-white">
                  Buat Pesanan
                </button>
                <button
                  type="button"
                  onClick={onBackToCart}
                  className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700"
                >
                  Kembali ke Keranjang
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}

export default function Home() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [now, setNow] = useState(new Date());
  const [notice, setNotice] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [confirmingCheckout, setConfirmingCheckout] = useState(false);
  const [submittingCheckout, setSubmittingCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(defaultSiteSettings);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(defaultPaymentSettings);
  const [footerSettings, setFooterSettings] = useState<FooterSettings>(defaultFooterSettings);
  const [checkoutForm, setCheckoutForm] = useState<CheckoutForm>({
    name: "",
    phone: "",
    address: "",
    mapsUrl: "",
  });

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
        .select("full_name, phone, address, maps_url, role")
        .eq("id", user.id)
        .single();

      setProfile(data);
      setCheckoutForm((current) => ({
        ...current,
        name: data?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || current.name,
        phone: data?.phone || current.phone,
        address: data?.address || current.address,
        mapsUrl: data?.maps_url || current.mapsUrl,
      }));
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
        setCurrentPage(1);
      }
    }

    loadProducts();
  }, []);

  useEffect(() => {
    async function loadCustomSettings() {
      const [siteResult, paymentResult, footerResult] = await Promise.all([
        supabase.from("site_settings").select("store_name,welcome_template,welcome_description").eq("id", true).maybeSingle(),
        supabase.from("payment_settings").select("bank_name,account_number,account_holder,payment_logo_url,payment_note").eq("id", true).maybeSingle(),
        supabase.from("footer_settings").select("store_name,address,whatsapp,email,instagram,copyright_text").eq("id", true).maybeSingle(),
      ]);

      if (siteResult.data) setSiteSettings({ ...defaultSiteSettings, ...siteResult.data });
      if (paymentResult.data) setPaymentSettings({ ...defaultPaymentSettings, ...paymentResult.data });
      if (footerResult.data) setFooterSettings({ ...defaultFooterSettings, ...footerResult.data });
    }

    loadCustomSettings();
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

      return [...current, { ...product, qty: 1, note: "" }];
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

  function updateCartNote(productId: string, note: string) {
    setCart((current) => current.map((item) => (item.id === productId ? { ...item, note } : item)));
  }

  function updateCheckoutField(name: keyof CheckoutForm, value: string) {
    setCheckoutForm((current) => ({ ...current, [name]: value }));
  }

  function openCheckout() {
    if (cart.length === 0) return;
    setCheckoutError("");
    setCartOpen(false);
    setCheckoutOpen(true);
    setConfirmingCheckout(false);
  }

  function closeCheckout() {
    setCheckoutOpen(false);
    setConfirmingCheckout(false);
    setCheckoutError("");
  }

  function useCheckoutGps() {
    setNotice("");

    if (!navigator.geolocation) {
      setNotice("Browser ini tidak mendukung GPS.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        updateCheckoutField("mapsUrl", `https://www.google.com/maps?q=${latitude},${longitude}`);
      },
      () => {
        setNotice("Gagal mengambil titik GPS. Pastikan izin lokasi di browser aktif.");
      },
    );
  }

  function submitCheckoutForm() {
    setCheckoutError("");
    setConfirmingCheckout(true);
  }

  async function confirmCheckout() {
    if (submittingCheckout) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;

    if (!user) {
      setCheckoutError("Silakan login terlebih dahulu sebelum checkout.");
      setConfirmingCheckout(false);
      return;
    }

    setSubmittingCheckout(true);
    setNotice("");
    setCheckoutError("");
    const customerEmail = user.email || "";

    const totalProduk = cart.reduce(
      (total, item) => total + getDiscountedPrice(Number(item.harga), item.harga_diskon) * item.qty,
      0,
    );

    const orderPayload = {
      email_customer: customerEmail,
      customer_email: customerEmail,
      email: customerEmail,
      nama_penerima: checkoutForm.name,
      nama_customer: checkoutForm.name,
      nomor_whatsapp: checkoutForm.phone,
      no_whatsapp: checkoutForm.phone,
      whatsapp: checkoutForm.phone,
      telepon: checkoutForm.phone,
      alamat_pengiriman: checkoutForm.address,
      alamat_customer: checkoutForm.address,
      alamat: checkoutForm.address,
      titik_gps: checkoutForm.mapsUrl || null,
      gps_url: checkoutForm.mapsUrl || null,
      google_maps: checkoutForm.mapsUrl || null,
      total_harga: totalProduk,
      total: totalProduk,
      customer_name: checkoutForm.name,
      customer_phone: checkoutForm.phone,
      shipping_address: checkoutForm.address,
      maps_url: checkoutForm.mapsUrl || null,
      total_produk: totalProduk,
      shipping_cost: 0,
      ongkir: 0,
      grand_total: totalProduk,
      total_bayar: totalProduk,
      status: "menunggu_ongkir",
      status_pesanan: "menunggu_ongkir",
    };

    let order = null as { id: string } | null;
    let orderError = null as { message: string } | null;
    const statusFallbacks = ["Menunggu Ongkir", "pending", "Pending", "Baru", "Diproses"];
    let statusFallbackIndex = 0;
    const adaptivePayload: Record<string, string | number | null> = {
      ...orderPayload,
      customer_id: user.id,
      user_id: user.id,
    };

    for (let attempt = 0; attempt < 40; attempt += 1) {
      const result = await supabase.from("orders").insert(adaptivePayload).select("id").single();
      order = result.data;
      orderError = result.error;

      const missingColumn = getMissingColumn(orderError?.message);
      if (missingColumn) {
        delete adaptivePayload[missingColumn];
        continue;
      }

      if (isStatusConstraintError(orderError?.message)) {
        const nextStatus = statusFallbacks[statusFallbackIndex];
        statusFallbackIndex += 1;

        if (nextStatus) {
          adaptivePayload.status = nextStatus;
          adaptivePayload.status_pesanan = nextStatus;
        } else {
          delete adaptivePayload.status;
          delete adaptivePayload.status_pesanan;
        }

        continue;
      }

      const requiredColumn = getRequiredColumn(orderError?.message);
      if (requiredColumn) {
        adaptivePayload[requiredColumn] = getOrderFallbackValue(requiredColumn, user.id, customerEmail, checkoutForm, totalProduk);
        continue;
      }

      break;
    }

    if (orderError || !order) {
      setCheckoutError(`Gagal membuat pesanan: ${orderError?.message || "database belum menerima data pesanan."}`);
      setSubmittingCheckout(false);
      setConfirmingCheckout(false);
      return;
    }

    let orderItems = cart.map((item) => ({
      order_id: order.id,
      product_id: item.id,
      produk_id: item.id,
      nama_produk: item.nama_produk,
      product_name: item.nama_produk,
      harga: getDiscountedPrice(Number(item.harga), item.harga_diskon),
      price: getDiscountedPrice(Number(item.harga), item.harga_diskon),
      qty: item.qty,
      jumlah: item.qty,
      subtotal: getDiscountedPrice(Number(item.harga), item.harga_diskon) * item.qty,
      note: item.note || null,
      catatan: item.note || null,
      catatan_produk: item.note || null,
      item_note: item.note || null,
      keterangan: item.note || null,
    }));

    let itemsError = null as { message: string } | null;
    const noteColumns = ["note", "catatan", "catatan_produk", "item_note", "keterangan"];
    const removedItemColumns = new Set<string>();

    for (let attempt = 0; attempt < 30; attempt += 1) {
      const result = await supabase.from("order_items").insert(orderItems);
      itemsError = result.error;

      const missingColumn = getMissingColumn(itemsError?.message);
      if (missingColumn) {
        removedItemColumns.add(missingColumn);
        orderItems = orderItems.map((item) => {
          const nextItem = { ...item } as Record<string, string | number | null>;
          delete nextItem[missingColumn];
          return nextItem as typeof item;
        });

        const noteColumnsLeft = noteColumns.some((column) => Object.prototype.hasOwnProperty.call(orderItems[0] || {}, column));
        if (!noteColumnsLeft) {
          orderItems = orderItems.map((item, index) => {
            const note = cart[index]?.note?.trim() || "";
            if (!note) return item;

            const nextItem = {
              ...item,
            };

            if (!removedItemColumns.has("nama_produk") && "nama_produk" in nextItem) {
              nextItem.nama_produk = attachItemNoteFallback(String(nextItem.nama_produk || cart[index].nama_produk), note);
            }

            if (!removedItemColumns.has("product_name") && "product_name" in nextItem) {
              nextItem.product_name = attachItemNoteFallback(String(nextItem.product_name || cart[index].nama_produk), note);
            }

            return nextItem;
          });
        }
        continue;
      }

      const requiredColumn = getRequiredColumn(itemsError?.message);
      if (requiredColumn) {
        orderItems = orderItems.map((item, index) => ({
          ...item,
          [requiredColumn]: getOrderItemFallbackValue(requiredColumn, cart[index]),
        }));
        continue;
      }

      break;
    }

    if (itemsError) {
      await supabase.from("orders").delete().eq("id", order.id);
      setCheckoutError(`Gagal menyimpan detail produk: ${itemsError.message}`);
      setSubmittingCheckout(false);
      setConfirmingCheckout(false);
      return;
    }

    setCart([]);
    setCheckoutOpen(false);
    setConfirmingCheckout(false);
    setSubmittingCheckout(false);
    window.sessionStorage.setItem("checkout_success", "Kamu berhasil checkout. Pesanan masuk ke Daftar Pesanan dan sedang menunggu ongkir dari admin.");
    window.location.href = "/orders";
  }

  const name = profile?.full_name || "Pengunjung";
  const cartQty = cart.reduce((total, item) => total + item.qty, 0);
  const welcomeText = formatWelcome(siteSettings.welcome_template, getGreeting(), name);
  const totalPages = Math.max(1, Math.ceil(products.length / PRODUCTS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedProducts = products.slice((safeCurrentPage - 1) * PRODUCTS_PER_PAGE, safeCurrentPage * PRODUCTS_PER_PAGE);

  return (
    <main className="min-h-screen bg-[#fbf7f4] text-slate-950">
      <header className="border-b border-rose-100 bg-white/90">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/" className="inline-block text-xs font-bold uppercase tracking-[0.35em] text-rose-500 hover:text-rose-600">
              {siteSettings.store_name || footerSettings.store_name || "Tokoku"}
            </Link>
            <h1 className="mt-1 text-2xl font-bold">Katalog Produk</h1>
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <nav className="flex flex-wrap gap-2">
              {profile && (
                <Link href="/orders" className="rounded-md border border-rose-200 px-4 py-2 text-sm font-medium">
                  Daftar Pesanan
                </Link>
              )}
              {profile?.role === "admin" && (
                <Link href="/admin" className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white">
                  Admin
                </Link>
              )}
              {!profile && (
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
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-10">
        {notice && (
          <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            {notice}
          </div>
        )}

        <div className="rounded-lg border border-rose-100 bg-white p-6 shadow-sm md:p-8">
          <div>
            <p className="text-sm font-medium text-rose-600">
              {now.toLocaleDateString("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}, {now.toLocaleTimeString("id-ID", { hour12: false })}
            </p>
            <h2 className="mt-4 text-3xl font-bold md:text-4xl">{welcomeText}</h2>
            <p className="mt-4 max-w-2xl text-slate-600">
              {siteSettings.welcome_description || defaultSiteSettings.welcome_description}
            </p>
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

          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            {paginatedProducts.map((product) => (
              <ProductCard key={product.id} product={product} onAddToCart={addToCart} />
            ))}
          </div>

          {products.length === 0 && (
            <div className="mt-6 rounded-lg border border-dashed border-rose-200 bg-white px-5 py-10 text-center text-sm text-slate-500">
              Belum ada produk aktif. Tambahkan produk dari halaman admin.
            </div>
          )}

          {products.length > PRODUCTS_PER_PAGE && (
            <div className="mt-8 flex flex-col gap-3 rounded-lg border border-rose-100 bg-white px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="font-medium text-slate-600">
                Halaman {safeCurrentPage} dari {totalPages}. Menampilkan {paginatedProducts.length} dari {products.length} produk.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={safeCurrentPage === 1}
                  className="rounded-md border border-slate-300 px-4 py-2 font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Sebelumnya
                </button>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`rounded-md px-4 py-2 font-bold ${
                      page === safeCurrentPage ? "bg-slate-950 text-white" : "border border-slate-300 text-slate-700"
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={safeCurrentPage === totalPages}
                  className="rounded-md border border-slate-300 px-4 py-2 font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          )}
        </section>
      </section>

      {profile && (
        <section className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-5 pb-8">
          <Link href="/settings" className="rounded-md border border-rose-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm">
            Setting
          </Link>
          <button onClick={logout} className="rounded-md bg-rose-600 px-4 py-2 text-sm font-bold text-white shadow-sm">
            Logout
          </button>
        </section>
      )}

      <footer className="border-t border-rose-100 bg-white">
        <div className="mx-auto grid max-w-6xl gap-5 px-5 py-8 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href="/" className="inline-block text-xs font-bold uppercase tracking-[0.35em] text-rose-500 hover:text-rose-600">
              {footerSettings.store_name || siteSettings.store_name || "Tokoku"}
            </Link>
            <p className="mt-3 leading-6">{footerSettings.address || "Alamat toko belum diatur."}</p>
          </div>
          <div>
            <h3 className="font-bold text-slate-950">Kontak</h3>
            <p className="mt-3">WhatsApp: {footerSettings.whatsapp || "-"}</p>
            <p className="mt-2">Email: {footerSettings.email || "-"}</p>
          </div>
          <div>
            <h3 className="font-bold text-slate-950">Sosial Media</h3>
            <p className="mt-3">{footerSettings.instagram || "-"}</p>
          </div>
          <div>
            <h3 className="font-bold text-slate-950">Copyright</h3>
            <p className="mt-3 leading-6">{footerSettings.copyright_text || defaultFooterSettings.copyright_text}</p>
          </div>
        </div>
      </footer>

      {cartOpen && (
        <CartPanel
          cart={cart}
          onClose={() => setCartOpen(false)}
          onIncrease={increaseCartQty}
          onDecrease={decreaseCartQty}
          onRemove={removeFromCart}
          onCheckout={openCheckout}
          onUpdateNote={updateCartNote}
        />
      )}

      {checkoutOpen && (
        <CheckoutPanel
          cart={cart}
          form={checkoutForm}
          confirming={confirmingCheckout}
          checkoutError={checkoutError}
          submitting={submittingCheckout}
          paymentSettings={paymentSettings}
          onClose={closeCheckout}
          onBackToCart={() => {
            setCheckoutOpen(false);
            setConfirmingCheckout(false);
            setCartOpen(true);
          }}
          onChange={updateCheckoutField}
          onUseGps={useCheckoutGps}
          onSubmit={submitCheckoutForm}
          onConfirm={confirmCheckout}
          onCancelConfirm={() => setConfirmingCheckout(false)}
        />
      )}
    </main>
  );
}
