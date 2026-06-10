"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type OrderItem = {
  id: string;
  nama_produk: string;
  harga: number;
  qty: number;
  note: string | null;
};

type Order = {
  id: string;
  status: "Menunggu Ongkir" | "Menunggu Pembayaran" | "Pesanan Dikirim" | "Ditolak";
  customer_name: string | null;
  customer_phone: string | null;
  shipping_address: string | null;
  maps_url: string | null;
  total_produk: number;
  shipping_cost: number;
  grand_total: number;
  payment_proof_url: string | null;
  payment_rejected_reason: string | null;
  tracking_number: string | null;
  courier_name: string | null;
  courier_logo_url: string | null;
  tracking_url: string | null;
  created_at: string;
  order_items: OrderItem[];
};

type PaymentSettings = {
  bank_name: string;
  account_number: string;
  account_holder: string;
  payment_logo_url: string;
  payment_note: string;
};

const defaultPaymentSettings: PaymentSettings = {
  bank_name: "",
  account_number: "",
  account_holder: "",
  payment_logo_url: "",
  payment_note: "",
};

const officialPaymentWarning =
  "Transfer sesuai Grand Total hanya ke rekening resmi di bawah ini. Pembayaran di luar rekening resmi toko tidak menjadi tanggung jawab kami. Setelah transfer berhasil, upload bukti pembayaran pada pesanan ini.";

function formatCurrency(value: number | null | undefined) {
  return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
}

function statusClass(status: Order["status"]) {
  if (status === "Menunggu Ongkir") return "bg-amber-50 text-amber-700 border-amber-200";
  if (status === "Menunggu Pembayaran") return "bg-sky-50 text-sky-700 border-sky-200";
  if (status === "Pesanan Dikirim") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  return "bg-rose-50 text-rose-700 border-rose-200";
}

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(defaultPaymentSettings);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [uploadingId, setUploadingId] = useState("");

  useEffect(() => {
    async function loadData() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        router.push("/login");
        return;
      }

      setUserId(user.id);

      const [ordersResult, paymentResult] = await Promise.all([
        supabase
          .from("orders")
          .select("*, order_items(*)")
          .eq("customer_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("payment_settings")
          .select("bank_name,account_number,account_holder,payment_logo_url,payment_note")
          .eq("id", true)
          .maybeSingle(),
      ]);

      if (ordersResult.data) setOrders(ordersResult.data as Order[]);
      if (paymentResult.data) setPaymentSettings({ ...defaultPaymentSettings, ...paymentResult.data });
      setLoading(false);
    }

    loadData();
  }, [router]);

  async function uploadPaymentProof(order: Order, file: File | undefined) {
    if (!file || !userId || uploadingId) return;

    setMessage("");
    setUploadingId(order.id);

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${userId}/${order.id}-${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("payment-proofs").upload(path, file, {
      upsert: false,
    });

    if (uploadError) {
      setMessage(uploadError.message);
      setUploadingId("");
      return;
    }

    const { data } = supabase.storage.from("payment-proofs").getPublicUrl(path);
    const { error: updateError } = await supabase.rpc("customer_upload_payment_proof", {
      order_id_to_update: order.id,
      proof_url: data.publicUrl,
    });

    if (updateError) {
      setMessage(updateError.message);
      setUploadingId("");
      return;
    }

    setOrders((current) =>
      current.map((item) => (item.id === order.id ? { ...item, payment_proof_url: data.publicUrl } : item)),
    );
    setMessage("Bukti pembayaran berhasil diupload. Admin akan melakukan verifikasi.");
    setUploadingId("");
  }

  function copyTrackingNumber(trackingNumber: string) {
    navigator.clipboard.writeText(trackingNumber);
    setMessage("Nomor resi berhasil dicopy.");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fbf7f4] text-slate-950">
        <p className="text-sm font-medium text-slate-600">Memuat daftar pesanan...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fbf7f4] text-slate-950">
      <header className="border-b border-rose-100 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <div>
            <Link href="/" className="text-xs font-bold uppercase tracking-[0.35em] text-rose-500 hover:text-rose-600">
              Tokoku
            </Link>
            <h1 className="mt-1 text-2xl font-bold">Daftar Pesanan</h1>
          </div>
          <Link href="/" className="rounded-md bg-slate-950 px-4 py-2 text-sm font-bold text-white">
            Kembali Belanja
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-8">
        {message && (
          <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            {message}
          </div>
        )}

        <div className="grid gap-5">
          {orders.map((order) => (
            <article key={order.id} className="rounded-lg border border-rose-100 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-rose-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-rose-500">
                    {new Date(order.created_at).toLocaleString("id-ID")}
                  </p>
                  <h2 className="mt-1 text-xl font-bold">Pesanan #{order.id.slice(0, 8)}</h2>
                </div>
                <span className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${statusClass(order.status)}`}>
                  {order.status}
                </span>
              </div>

              <div className="grid gap-5 p-5 lg:grid-cols-[1fr_320px]">
                <div className="grid gap-4">
                  <div className="rounded-lg border border-slate-200 p-4">
                    <h3 className="font-bold">Detail Produk</h3>
                    <div className="mt-3 grid gap-2">
                      {order.order_items.map((item) => (
                        <div key={item.id} className="rounded-md bg-slate-50 px-3 py-2 text-sm">
                          <div className="flex justify-between gap-3">
                            <span>{item.nama_produk} x {item.qty}</span>
                            <strong>{formatCurrency(Number(item.harga) * item.qty)}</strong>
                          </div>
                          {item.note && <p className="mt-1 text-xs text-slate-500">Catatan: {item.note}</p>}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 p-4 text-sm leading-6 text-slate-600">
                    <h3 className="mb-2 font-bold text-slate-950">Penerima</h3>
                    <p>{order.customer_name || "-"}</p>
                    <p>{order.customer_phone || "-"}</p>
                    <p>{order.shipping_address || "-"}</p>
                    {order.maps_url && (
                      <a href={order.maps_url} target="_blank" rel="noreferrer" className="font-bold text-rose-600">
                        Buka titik Google Maps
                      </a>
                    )}
                  </div>
                </div>

                <div className="grid content-start gap-4">
                  <div className="rounded-lg border border-slate-200 p-4">
                    <h3 className="font-bold">Ringkasan Pembayaran</h3>
                    <div className="mt-3 grid gap-2 text-sm">
                      <div className="flex justify-between"><span>Total Produk</span><strong>{formatCurrency(order.total_produk)}</strong></div>
                      <div className="flex justify-between"><span>Ongkir</span><strong>{formatCurrency(order.shipping_cost)}</strong></div>
                      <div className="flex justify-between border-t border-slate-200 pt-2 text-base">
                        <span>Grand Total</span><strong>{formatCurrency(order.grand_total)}</strong>
                      </div>
                    </div>
                  </div>

                  {order.status === "Menunggu Ongkir" && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                      Admin sedang menentukan ongkir. Upload bukti pembayaran akan aktif setelah ongkir disimpan.
                    </div>
                  )}

                  {order.status === "Menunggu Pembayaran" && (
                    <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
                      <div className="flex items-start gap-3">
                        {paymentSettings.payment_logo_url && (
                          <img src={paymentSettings.payment_logo_url} alt={paymentSettings.bank_name} className="h-12 w-16 rounded-md bg-white object-contain p-2" />
                        )}
                        <div className="text-sm leading-6">
                          <h3 className="font-bold text-slate-950">{paymentSettings.bank_name || "Rekening belum diatur"}</h3>
                          <p>No. Rekening: <strong>{paymentSettings.account_number || "-"}</strong></p>
                          <p>Atas Nama: <strong>{paymentSettings.account_holder || "-"}</strong></p>
                        </div>
                      </div>
                      <p className="mt-3 rounded-md bg-white px-3 py-3 text-sm leading-6 text-slate-600">
                        {paymentSettings.payment_note || officialPaymentWarning}
                      </p>
                      {order.payment_proof_url ? (
                        <a href={order.payment_proof_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-md bg-white px-4 py-2 text-sm font-bold text-sky-700">
                          Lihat bukti pembayaran
                        </a>
                      ) : (
                        <label className="mt-3 grid gap-2 text-sm font-bold text-slate-950">
                          Upload Bukti Pembayaran
                          <input
                            type="file"
                            accept="image/*"
                            disabled={uploadingId === order.id}
                            onChange={(event) => uploadPaymentProof(order, event.target.files?.[0])}
                            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-rose-100 file:px-3 file:py-2 file:font-bold file:text-rose-700"
                          />
                        </label>
                      )}
                    </div>
                  )}

                  {order.status === "Ditolak" && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800">
                      <strong>Pembayaran ditolak.</strong>
                      <p>{order.payment_rejected_reason || "Admin belum memberi alasan."}</p>
                    </div>
                  )}

                  {order.status === "Pesanan Dikirim" && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                      <div className="flex items-start gap-3">
                        {order.courier_logo_url && (
                          <img src={order.courier_logo_url} alt={order.courier_name || "Logo kurir"} className="h-12 w-16 rounded-md bg-white object-contain p-2" />
                        )}
                        <div>
                          <h3 className="font-bold text-emerald-950">{order.courier_name || "Kurir"}</h3>
                          <p className="text-sm text-emerald-800">Resi: <strong>{order.tracking_number || "-"}</strong></p>
                        </div>
                      </div>
                      {order.tracking_number && (
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(order.tracking_number)}`}
                          alt="QR Code Resi"
                          className="mt-4 h-32 w-32 rounded-md bg-white p-2"
                        />
                      )}
                      <div className="mt-4 flex flex-wrap gap-2">
                        {order.tracking_number && (
                          <button onClick={() => copyTrackingNumber(order.tracking_number || "")} className="rounded-md bg-white px-4 py-2 text-sm font-bold text-emerald-700">
                            Copy Resi
                          </button>
                        )}
                        {order.tracking_url && (
                          <a href={order.tracking_url} target="_blank" rel="noreferrer" className="rounded-md bg-slate-950 px-4 py-2 text-sm font-bold text-white">
                            Cek Resi
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>

        {orders.length === 0 && (
          <div className="rounded-lg border border-dashed border-rose-200 bg-white px-5 py-10 text-center text-sm text-slate-500">
            Belum ada pesanan. Silakan pilih produk dari katalog.
          </div>
        )}
      </section>
    </main>
  );
}
