"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Status = "menunggu_ongkir" | "menunggu_pembayaran" | "pesanan_dikirim" | "ditolak";
type FilterStatus = Status | "semua";

type Profile = {
  email: string;
  role: "customer" | "admin" | "manager";
};

type Row = Record<string, unknown>;

type OrderItem = Row & {
  id: string;
  nama_produk?: string | null;
  product_name?: string | null;
  harga?: number | null;
  price?: number | null;
  qty?: number | null;
  jumlah?: number | null;
  subtotal?: number | null;
  note?: string | null;
  catatan?: string | null;
};

type Order = Row & {
  id: string;
  status?: string | null;
  status_pesanan?: string | null;
  customer_name?: string | null;
  nama_penerima?: string | null;
  nama_customer?: string | null;
  customer_phone?: string | null;
  nomor_whatsapp?: string | null;
  no_whatsapp?: string | null;
  whatsapp?: string | null;
  shipping_address?: string | null;
  alamat_pengiriman?: string | null;
  alamat_customer?: string | null;
  alamat?: string | null;
  maps_url?: string | null;
  titik_gps?: string | null;
  gps_url?: string | null;
  google_maps?: string | null;
  total_produk?: number | null;
  total_harga?: number | null;
  total?: number | null;
  shipping_cost?: number | null;
  ongkir?: number | null;
  grand_total?: number | null;
  total_bayar?: number | null;
  payment_proof_url?: string | null;
  bukti_pembayaran?: string | null;
  payment_rejected_reason?: string | null;
  alasan_penolakan?: string | null;
  tracking_number?: string | null;
  nomor_resi?: string | null;
  courier_name?: string | null;
  nama_kurir?: string | null;
  courier_logo_url?: string | null;
  logo_kurir?: string | null;
  tracking_url?: string | null;
  link_tracking?: string | null;
  paid_at?: string | null;
  shipped_at?: string | null;
  updated_at?: string | null;
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

const statuses: FilterStatus[] = ["semua", "menunggu_ongkir", "menunggu_pembayaran", "pesanan_dikirim", "ditolak"];

function asNumber(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function firstText(...values: unknown[]) {
  const value = values.find((item) => typeof item === "string" && item.trim().length > 0);
  return typeof value === "string" ? value : "";
}

function formatCurrency(value: number | null | undefined) {
  return `Rp ${asNumber(value).toLocaleString("id-ID")}`;
}

function normalizeStatus(order: Order): Status {
  const raw = firstText(order.status, order.status_pesanan).toLowerCase().replaceAll(" ", "_");
  if (raw.includes("ongkir")) return "menunggu_ongkir";
  if (raw.includes("pembayaran") || raw === "pending" || raw === "baru") return "menunggu_pembayaran";
  if (raw.includes("kirim") || raw.includes("dikirim")) return "pesanan_dikirim";
  if (raw.includes("tolak")) return "ditolak";
  return "menunggu_ongkir";
}

function statusLabel(status: Status) {
  return status.replaceAll("_", " ");
}

function statusClass(status: Status) {
  if (status === "menunggu_ongkir") return "bg-amber-50 text-amber-700 border-amber-200";
  if (status === "menunggu_pembayaran") return "bg-sky-50 text-sky-700 border-sky-200";
  if (status === "pesanan_dikirim") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  return "bg-rose-50 text-rose-700 border-rose-200";
}

function itemName(item: OrderItem) {
  return firstText(item.nama_produk, item.product_name, item.name) || "Produk";
}

function itemQty(item: OrderItem) {
  return asNumber(item.qty ?? item.jumlah) || 1;
}

function itemPrice(item: OrderItem) {
  const qty = itemQty(item);
  const subtotal = asNumber(item.subtotal);
  if (subtotal > 0 && qty > 0) return subtotal / qty;
  return asNumber(item.harga ?? item.price);
}

function itemSubtotal(item: OrderItem) {
  const subtotal = asNumber(item.subtotal);
  return subtotal > 0 ? subtotal : itemPrice(item) * itemQty(item);
}

function orderItemsTotal(order: Order) {
  return (order.order_items || []).reduce((total, item) => total + itemSubtotal(item), 0);
}

function orderTotalProduk(order: Order) {
  return asNumber(order.total_produk ?? order.total_harga ?? order.total) || orderItemsTotal(order);
}

function orderOngkir(order: Order) {
  return asNumber(order.shipping_cost ?? order.ongkir);
}

function orderGrandTotal(order: Order) {
  return asNumber(order.grand_total ?? order.total_bayar) || orderTotalProduk(order) + orderOngkir(order);
}

function orderName(order: Order) {
  return firstText(order.customer_name, order.nama_penerima, order.nama_customer);
}

function orderPhone(order: Order) {
  return firstText(order.customer_phone, order.nomor_whatsapp, order.no_whatsapp, order.whatsapp, order.telepon);
}

function orderAddress(order: Order) {
  return firstText(order.shipping_address, order.alamat_pengiriman, order.alamat_customer, order.alamat);
}

function orderMaps(order: Order) {
  return firstText(order.maps_url, order.titik_gps, order.gps_url, order.google_maps);
}

function orderProof(order: Order) {
  return firstText(order.payment_proof_url, order.bukti_pembayaran);
}

function trackingNumber(order: Order) {
  return firstText(order.tracking_number, order.nomor_resi);
}

function courierName(order: Order) {
  return firstText(order.courier_name, order.nama_kurir);
}

function courierLogo(order: Order) {
  return firstText(order.courier_logo_url, order.logo_kurir);
}

function trackingUrl(order: Order) {
  return firstText(order.tracking_url, order.link_tracking);
}

function getMissingColumn(errorMessage: string | undefined) {
  return errorMessage?.match(/Could not find the '([^']+)' column/)?.[1] || "";
}

function makeDraft(order: Order): Draft {
  return {
    shippingCost: String(orderOngkir(order) || ""),
    courierName: courierName(order),
    rejectReason: firstText(order.payment_rejected_reason, order.alasan_penolakan),
    trackingNumber: trackingNumber(order),
    courierLogoUrl: courierLogo(order),
    trackingUrl: trackingUrl(order),
  };
}

export default function AdminOrdersPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [filter, setFilter] = useState<FilterStatus>("semua");
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

      const { data: profileData } = await supabase.from("profiles").select("email, role").eq("id", user.id).single();

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
    const { data } = await supabase.from("orders").select("*, order_items(*)").order("created_at", { ascending: false });

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

  async function updateOrder(orderId: string, payload: Row, successMessage: string) {
    setSavingId(orderId);
    setMessage("");

    const adaptivePayload = { ...payload };
    let error: { message: string } | null = null;

    for (let attempt = 0; attempt < 30; attempt += 1) {
      const result = await supabase.from("orders").update(adaptivePayload).eq("id", orderId);
      error = result.error;

      const missingColumn = getMissingColumn(error?.message);
      if (!missingColumn) break;

      delete adaptivePayload[missingColumn];
    }

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
    const totalProduk = orderTotalProduk(order);

    if (shippingCost < 0) {
      setMessage("Ongkir tidak boleh minus.");
      return;
    }

    await updateOrder(
      order.id,
      {
        shipping_cost: shippingCost,
        ongkir: shippingCost,
        total_produk: totalProduk,
        total_harga: totalProduk,
        total: totalProduk,
        grand_total: totalProduk + shippingCost,
        total_bayar: totalProduk + shippingCost,
        courier_name: draft?.courierName || null,
        nama_kurir: draft?.courierName || null,
        status: "menunggu_pembayaran",
        status_pesanan: "menunggu_pembayaran",
        updated_at: new Date().toISOString(),
      },
      "Ongkir berhasil disimpan.",
    );
  }

  async function rejectPayment(order: Order) {
    const draft = drafts[order.id];

    await updateOrder(
      order.id,
      {
        status: "ditolak",
        status_pesanan: "ditolak",
        payment_rejected_reason: draft?.rejectReason?.trim() || "Pesanan ditolak admin.",
        alasan_penolakan: draft?.rejectReason?.trim() || "Pesanan ditolak admin.",
        updated_at: new Date().toISOString(),
      },
      "Pesanan berhasil ditolak.",
    );
  }

  async function approvePayment(order: Order) {
    if (!orderProof(order)) {
      setMessage("Customer harus upload bukti pembayaran sebelum pesanan bisa di-approve.");
      return;
    }

    await updateOrder(
      order.id,
      {
        status: "pesanan_dikirim",
        status_pesanan: "pesanan_dikirim",
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      "Pembayaran berhasil di-approve.",
    );
  }

  async function uploadCourierLogo(order: Order, file: File | undefined) {
    if (!file) return;

    setSavingId(order.id);
    setMessage("");

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `courier-logos/${order.id}-${crypto.randomUUID()}-${safeName}`;
    const { error } = await supabase.storage.from("payment-assets").upload(path, file, { upsert: false });

    if (error) {
      setMessage(error.message);
      setSavingId("");
      return;
    }

    const { data } = supabase.storage.from("payment-assets").getPublicUrl(path);
    updateDraft(order.id, "courierLogoUrl", data.publicUrl);
    setSavingId("");
  }

  async function saveTracking(order: Order) {
    const draft = drafts[order.id];

    await updateOrder(
      order.id,
      {
        status: "pesanan_dikirim",
        status_pesanan: "pesanan_dikirim",
        tracking_number: draft?.trackingNumber || null,
        nomor_resi: draft?.trackingNumber || null,
        courier_name: draft?.courierName || null,
        nama_kurir: draft?.courierName || null,
        courier_logo_url: draft?.courierLogoUrl || null,
        logo_kurir: draft?.courierLogoUrl || null,
        tracking_url: draft?.trackingUrl || null,
        link_tracking: draft?.trackingUrl || null,
        shipped_at: draft?.trackingNumber ? new Date().toISOString() : order.shipped_at,
        updated_at: new Date().toISOString(),
      },
      "Data pengiriman berhasil disimpan.",
    );
  }

  async function deleteOrder(order: Order) {
    if (!window.confirm("Yakin ingin menghapus pesanan ini?")) return;

    setSavingId(order.id);
    setMessage("");

    await supabase.from("order_items").delete().eq("order_id", order.id);
    const { error } = await supabase.from("orders").delete().eq("id", order.id);

    if (error) {
      setMessage(error.message);
      setSavingId("");
      return;
    }

    await loadOrders();
    setMessage("Pesanan berhasil dihapus.");
    setSavingId("");
  }

  const filteredOrders = useMemo(
    () => (filter === "semua" ? orders : orders.filter((order) => normalizeStatus(order) === filter)),
    [orders, filter],
  );

  const counts = useMemo(
    () => ({
      newOrders: orders.filter((order) => normalizeStatus(order) === "menunggu_ongkir").length,
      uploadedProofs: orders.filter((order) => normalizeStatus(order) === "menunggu_pembayaran" && orderProof(order)).length,
      needVerify: orders.filter((order) => normalizeStatus(order) === "menunggu_pembayaran" && orderProof(order)).length,
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
              onChange={(event) => setFilter(event.target.value as FilterStatus)}
              className="rounded-md border border-slate-300 px-3 py-2 font-medium outline-none focus:border-rose-400"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>{statusLabel(status as Status)}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6 grid gap-5">
          {filteredOrders.map((order) => {
            const draft = drafts[order.id] || makeDraft(order);
            const status = normalizeStatus(order);
            const proof = orderProof(order);
            const totalProduk = orderTotalProduk(order);
            const ongkir = orderOngkir(order);
            const grandTotal = orderGrandTotal(order);

            return (
              <article key={order.id} className="rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.25em] text-rose-500">
                      {new Date(order.created_at).toLocaleString("id-ID")}
                    </p>
                    <h2 className="mt-1 text-xl font-bold">Pesanan #{order.id.slice(0, 8)}</h2>
                    <p className="mt-1 text-sm text-slate-500">{orderName(order) || "-"} - {orderPhone(order) || "-"}</p>
                  </div>
                  <span className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${statusClass(status)}`}>
                    {statusLabel(status)}
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
                              <span>{itemName(item)} x {itemQty(item)}</span>
                              <strong>{formatCurrency(itemSubtotal(item))}</strong>
                            </div>
                            {firstText(item.note, item.catatan) && <p className="mt-1 text-xs text-slate-500">Catatan: {firstText(item.note, item.catatan)}</p>}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 p-4 text-sm leading-6 text-slate-600">
                      <h3 className="mb-2 font-bold text-slate-950">Alamat Customer</h3>
                      <p>Nama: {orderName(order) || "-"}</p>
                      <p>WhatsApp: {orderPhone(order) || "-"}</p>
                      <p>Alamat: {orderAddress(order) || "-"}</p>
                      {orderMaps(order) && (
                        <a href={orderMaps(order)} target="_blank" rel="noreferrer" className="font-bold text-rose-600">
                          Buka titik Google Maps
                        </a>
                      )}
                    </div>

                    {proof && (
                      <div className="rounded-lg border border-slate-200 p-4">
                        <h3 className="font-bold">Bukti Pembayaran</h3>
                        <a href={proof} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-md bg-slate-950 px-4 py-2 text-sm font-bold text-white">
                          Lihat Bukti
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="grid content-start gap-4">
                    <div className="rounded-lg border border-slate-200 p-4">
                      <h3 className="font-bold">Total</h3>
                      <div className="mt-3 grid gap-2 text-sm">
                        <div className="flex justify-between"><span>Total Produk</span><strong>{formatCurrency(totalProduk)}</strong></div>
                        <div className="flex justify-between"><span>Ongkir</span><strong>{formatCurrency(ongkir)}</strong></div>
                        <div className="flex justify-between border-t border-slate-200 pt-2 text-base"><span>Grand Total</span><strong>{formatCurrency(grandTotal)}</strong></div>
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

                    <div className="rounded-lg border border-slate-200 p-4">
                      <h3 className="font-bold">Verifikasi Pesanan</h3>
                      <div className="mt-3 grid gap-3">
                        <button
                          disabled={savingId === order.id || !proof}
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
                          Tolak Pesanan
                        </button>
                        <button
                          disabled={savingId === order.id}
                          onClick={() => deleteOrder(order)}
                          className="rounded-md border border-rose-200 bg-white px-4 py-2 text-sm font-bold text-rose-700 disabled:opacity-50"
                        >
                          Hapus Pesanan
                        </button>
                      </div>
                    </div>

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
                        <label className="grid gap-2 text-sm font-bold text-slate-700">
                          Logo kurir
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(event) => uploadCourierLogo(order, event.target.files?.[0])}
                            className="rounded-md border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-rose-100 file:px-3 file:py-2 file:font-bold file:text-rose-700"
                          />
                        </label>
                        {draft.courierLogoUrl && (
                          <img src={draft.courierLogoUrl} alt="Logo kurir" className="h-14 w-24 rounded-md border border-slate-200 object-contain p-2" />
                        )}
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
