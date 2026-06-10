"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Status = "Menunggu Ongkir" | "Menunggu Pembayaran" | "Pesanan Dikirim" | "Ditolak";

type Profile = {
  email: string;
  role: "customer" | "admin" | "manager";
};

type OrderItem = {
  id: string;
  nama_produk: string;
  harga: number;
  qty: number;
  note: string | null;
};

type Order = {
  id: string;
  status: Status;
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
  paid_at: string | null;
  shipped_at: string | null;
  updated_at: string | null;
  created_at: string;
  order_items: OrderItem[];
};

type Draft = {
  shippingCost: string;
  courierName: string;
  rejectReason: string;
  trackingNumber: string;
  courierLogoUrl: string;
  trackingUrl: string;
};

const statuses: Array<Status | "Semua"> = ["Semua", "Menunggu Ongkir", "Menunggu Pembayaran", "Pesanan Dikirim", "Ditolak"];

function formatCurrency(value: number | null | undefined) {
  return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
}

function statusClass(status: Status) {
  if (status === "Menunggu Ongkir") return "bg-amber-50 text-amber-700 border-amber-200";
  if (status === "Menunggu Pembayaran") return "bg-sky-50 text-sky-700 border-sky-200";
  if (status === "Pesanan Dikirim") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  return "bg-rose-50 text-rose-700 border-rose-200";
}

function makeDraft(order: Order): Draft {
  return {
    shippingCost: String(order.shipping_cost || ""),
    courierName: order.courier_name || "",
    rejectReason: order.payment_rejected_reason || "",
    trackingNumber: order.tracking_number || "",
    courierLogoUrl: order.courier_logo_url || "",
    trackingUrl: order.tracking_url || "",
  };
}

export default function AdminOrdersPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [filter, setFilter] = useState<Status | "Semua">("Semua");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function checkAccessAndLoad() {
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

      if (!profileData || !["admin", "manager"].includes(profileData.role)) {
        router.push("/");
        return;
      }

      setProfile(profileData as Profile);
      await loadOrders();
      setLoading(false);
    }

    checkAccessAndLoad();
  }, [router]);

  async function loadOrders() {
    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false });

    if (data) {
      const nextOrders = data as Order[];
      setOrders(nextOrders);
      setDrafts(Object.fromEntries(nextOrders.map((order) => [order.id, makeDraft(order)])));
    }
  }

  function updateDraft(orderId: string, key: keyof Draft, value: string) {
    setDrafts((current) => ({
      ...current,
      [orderId]: {
        ...current[orderId],
        [key]: value,
      },
    }));
  }

  async function updateOrder(orderId: string, payload: Partial<Order>, successMessage: string) {
    setSavingId(orderId);
    setMessage("");

    const { error } = await supabase.from("orders").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", orderId);

    if (error) {
      setMessage(error.message);
      setSavingId("");
      return;
    }

    await loadOrders();
    setMessage(successMessage);
    setSavingId("");
  }

  async function saveShipping(order: Order) {
    const draft = drafts[order.id];
    const shippingCost = Number(draft?.shippingCost || 0);

    if (shippingCost < 0) {
      setMessage("Ongkir tidak boleh minus.");
      return;
    }

    await updateOrder(
      order.id,
      {
        shipping_cost: shippingCost,
        grand_total: Number(order.total_produk || 0) + shippingCost,
        courier_name: draft?.courierName || null,
        status: "Menunggu Pembayaran",
      },
      "Ongkir berhasil disimpan. Status berubah menjadi Menunggu Pembayaran.",
    );
  }

  async function rejectPayment(order: Order) {
    const draft = drafts[order.id];

    if (!draft?.rejectReason.trim()) {
      setMessage("Isi alasan penolakan terlebih dahulu.");
      return;
    }

    await updateOrder(
      order.id,
      {
        status: "Ditolak",
        payment_rejected_reason: draft.rejectReason.trim(),
      },
      "Pembayaran ditolak dan alasan sudah tersimpan.",
    );
  }

  async function approvePayment(order: Order) {
    await updateOrder(
      order.id,
      {
        status: "Pesanan Dikirim",
        paid_at: new Date().toISOString(),
      },
      "Pembayaran disetujui. Status berubah menjadi Pesanan Dikirim.",
    );
  }

  async function saveTracking(order: Order) {
    const draft = drafts[order.id];

    await updateOrder(
      order.id,
      {
        status: "Pesanan Dikirim",
        tracking_number: draft?.trackingNumber || null,
        courier_name: draft?.courierName || null,
        courier_logo_url: draft?.courierLogoUrl || null,
        tracking_url: draft?.trackingUrl || null,
        shipped_at: draft?.trackingNumber ? new Date().toISOString() : order.shipped_at,
      },
      "Data pengiriman berhasil disimpan.",
    );
  }

  const filteredOrders = useMemo(
    () => (filter === "Semua" ? orders : orders.filter((order) => order.status === filter)),
    [orders, filter],
  );

  const counts = useMemo(
    () => ({
      newOrders: orders.filter((order) => order.status === "Menunggu Ongkir").length,
      uploadedProofs: orders.filter((order) => order.status === "Menunggu Pembayaran" && order.payment_proof_url).length,
      needVerify: orders.filter((order) => order.status === "Menunggu Pembayaran" && order.payment_proof_url).length,
    }),
    [orders],
  );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-950">
        <p className="text-sm font-medium text-slate-600">Memeriksa pesanan...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{profile?.email}</p>
            <h1 className="mt-1 text-2xl font-bold">Pesanan</h1>
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

      <section className="mx-auto max-w-7xl px-5 py-8">
        {message && (
          <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            {message}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Pesanan Baru</p>
            <p className="mt-2 text-3xl font-bold">{counts.newOrders}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Bukti Terupload</p>
            <p className="mt-2 text-3xl font-bold">{counts.uploadedProofs}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Perlu Verifikasi</p>
            <p className="mt-2 text-3xl font-bold">{counts.needVerify}</p>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <label className="grid max-w-xs gap-2 text-sm font-bold">
            Filter Status
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as Status | "Semua")}
              className="rounded-md border border-slate-300 px-3 py-2 font-medium outline-none focus:border-rose-400"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6 grid gap-5">
          {filteredOrders.map((order) => {
            const draft = drafts[order.id] || makeDraft(order);

            return (
              <article key={order.id} className="rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.25em] text-rose-500">
                      {new Date(order.created_at).toLocaleString("id-ID")}
                    </p>
                    <h2 className="mt-1 text-xl font-bold">Pesanan #{order.id.slice(0, 8)}</h2>
                    <p className="mt-1 text-sm text-slate-500">{order.customer_name || "-"} - {order.customer_phone || "-"}</p>
                  </div>
                  <span className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${statusClass(order.status)}`}>
                    {order.status}
                  </span>
                </div>

                <div className="grid gap-5 p-5 xl:grid-cols-[1fr_360px]">
                  <div className="grid gap-4">
                    <div className="rounded-lg border border-slate-200 p-4">
                      <h3 className="font-bold">Produk</h3>
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
                      <h3 className="mb-2 font-bold text-slate-950">Alamat Customer</h3>
                      <p>{order.shipping_address || "-"}</p>
                      {order.maps_url && (
                        <a href={order.maps_url} target="_blank" rel="noreferrer" className="font-bold text-rose-600">
                          Buka titik Google Maps
                        </a>
                      )}
                    </div>

                    {order.payment_proof_url && (
                      <div className="rounded-lg border border-slate-200 p-4">
                        <h3 className="font-bold">Bukti Pembayaran</h3>
                        <a href={order.payment_proof_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-md bg-slate-950 px-4 py-2 text-sm font-bold text-white">
                          Lihat Bukti
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="grid content-start gap-4">
                    <div className="rounded-lg border border-slate-200 p-4">
                      <h3 className="font-bold">Total</h3>
                      <div className="mt-3 grid gap-2 text-sm">
                        <div className="flex justify-between"><span>Total Produk</span><strong>{formatCurrency(order.total_produk)}</strong></div>
                        <div className="flex justify-between"><span>Ongkir</span><strong>{formatCurrency(order.shipping_cost)}</strong></div>
                        <div className="flex justify-between border-t border-slate-200 pt-2 text-base"><span>Grand Total</span><strong>{formatCurrency(order.grand_total)}</strong></div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 p-4">
                      <h3 className="font-bold">Ongkir</h3>
                      <div className="mt-3 grid gap-3">
                        <input
                          value={draft.shippingCost}
                          onChange={(event) => updateDraft(order.id, "shippingCost", event.target.value)}
                          type="number"
                          min="0"
                          placeholder="Ongkir"
                          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-rose-400"
                        />
                        <input
                          value={draft.courierName}
                          onChange={(event) => updateDraft(order.id, "courierName", event.target.value)}
                          placeholder="Nama kurir opsional"
                          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-rose-400"
                        />
                        <button
                          disabled={savingId === order.id}
                          onClick={() => saveShipping(order)}
                          className="rounded-md bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                        >
                          Simpan Ongkir
                        </button>
                      </div>
                    </div>

                    {order.payment_proof_url && order.status === "Menunggu Pembayaran" && (
                      <div className="rounded-lg border border-slate-200 p-4">
                        <h3 className="font-bold">Verifikasi Pembayaran</h3>
                        <div className="mt-3 grid gap-3">
                          <button
                            disabled={savingId === order.id}
                            onClick={() => approvePayment(order)}
                            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                          >
                            Approve Pembayaran
                          </button>
                          <textarea
                            value={draft.rejectReason}
                            onChange={(event) => updateDraft(order.id, "rejectReason", event.target.value)}
                            placeholder="Alasan penolakan"
                            rows={3}
                            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-rose-400"
                          />
                          <button
                            disabled={savingId === order.id}
                            onClick={() => rejectPayment(order)}
                            className="rounded-md bg-rose-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                          >
                            Tolak Pembayaran
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="rounded-lg border border-slate-200 p-4">
                      <h3 className="font-bold">Pengiriman / Resi</h3>
                      <div className="mt-3 grid gap-3">
                        <input
                          value={draft.trackingNumber}
                          onChange={(event) => updateDraft(order.id, "trackingNumber", event.target.value)}
                          placeholder="Nomor resi"
                          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-rose-400"
                        />
                        <input
                          value={draft.courierName}
                          onChange={(event) => updateDraft(order.id, "courierName", event.target.value)}
                          placeholder="Nama kurir"
                          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-rose-400"
                        />
                        <input
                          value={draft.courierLogoUrl}
                          onChange={(event) => updateDraft(order.id, "courierLogoUrl", event.target.value)}
                          placeholder="URL logo kurir"
                          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-rose-400"
                        />
                        <input
                          value={draft.trackingUrl}
                          onChange={(event) => updateDraft(order.id, "trackingUrl", event.target.value)}
                          placeholder="Link tracking / cek resi"
                          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-rose-400"
                        />
                        <button
                          disabled={savingId === order.id}
                          onClick={() => saveTracking(order)}
                          className="rounded-md bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                        >
                          Simpan Pengiriman
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {filteredOrders.length === 0 && (
          <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-white px-5 py-10 text-center text-sm text-slate-500">
            Belum ada pesanan untuk filter ini.
          </div>
        )}
      </section>
    </main>
  );
}
