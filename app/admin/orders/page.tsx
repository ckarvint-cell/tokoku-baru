"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Status = "menunggu_ongkir" | "menunggu_pembayaran" | "menunggu_konfirmasi" | "diproses" | "pesanan_dikirim" | "ditolak";
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

type CourierSetting = {
  id: string;
  name: string;
};

type StoredPaymentProof = {
  name: string;
  created_at?: string | null;
  updated_at?: string | null;
};

const statuses: FilterStatus[] = ["semua", "menunggu_ongkir", "menunggu_pembayaran", "menunggu_konfirmasi", "diproses", "pesanan_dikirim", "ditolak"];

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

function formatNumberInput(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits).toLocaleString("id-ID") : "";
}

function parseNumberInput(value: string | undefined) {
  return Number((value || "").replace(/\D/g, "")) || 0;
}

function normalizeStatus(order: Order): Status {
  const raw = firstText(order.status, order.status_pesanan).toLowerCase().replaceAll(" ", "_");
  if (raw.includes("tolak")) return "ditolak";
  if (raw.includes("proses") || raw.includes("diproses")) return "diproses";
  if (raw.includes("kirim") || raw.includes("dikirim") || trackingNumber(order) || order.paid_at) return "pesanan_dikirim";
  if (orderOngkir(order) <= 0) return "menunggu_ongkir";
  if (raw.includes("konfirmasi") || orderProof(order)) return "menunggu_konfirmasi";
  return "menunggu_pembayaran";
}

function statusLabel(status: FilterStatus) {
  if (status === "semua") return "Semua";
  if (status === "menunggu_ongkir") return "Menunggu Ongkir";
  if (status === "menunggu_pembayaran") return "Menunggu Pembayaran";
  if (status === "menunggu_konfirmasi") return "Menunggu Konfirmasi";
  if (status === "diproses") return "Diproses";
  if (status === "pesanan_dikirim") return "Sedang Dikirim";
  return "Ditolak";
}

function statusClass(status: Status) {
  if (status === "menunggu_ongkir") return "bg-amber-50 text-amber-700 border-amber-200";
  if (status === "menunggu_pembayaran") return "bg-sky-50 text-sky-700 border-sky-200";
  if (status === "menunggu_konfirmasi") return "bg-violet-50 text-violet-700 border-violet-200";
  if (status === "diproses") return "bg-indigo-50 text-indigo-700 border-indigo-200";
  if (status === "pesanan_dikirim") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  return "bg-rose-50 text-rose-700 border-rose-200";
}

function itemName(item: OrderItem) {
  return (firstText(item.nama_produk, item.product_name, item.name) || "Produk").split(" ||CATATAN:")[0];
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

function itemNote(item: OrderItem) {
  const explicitNote = firstText(item.note, item.catatan, item["catatan_produk"], item["item_note"], item["keterangan"]);
  if (explicitNote) return explicitNote;

  const nameWithFallback = firstText(item.nama_produk, item.product_name, item.name);
  return nameWithFallback.includes(" ||CATATAN:") ? nameWithFallback.split(" ||CATATAN:").slice(1).join(" ||CATATAN:") : "";
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
  const explicitProof = firstText(
    order.payment_proof_url,
    order.bukti_pembayaran,
    order["bukti_transfer"],
    order["proof_url"],
    order["payment_receipt_url"],
    order["receipt_url"],
  );

  if (explicitProof) return explicitProof;

  const storageProof = Object.values(order).find(
    (value) =>
      typeof value === "string" &&
      (value.includes("/payment-proofs/") || value.includes("payment-proofs")),
  );

  return typeof storageProof === "string" ? storageProof : "";
}

function orderCustomerId(order: Order) {
  return firstText(order["customer_id"], order["user_id"]);
}

function paymentProofUrlFromPath(path: string) {
  return supabase.storage.from("payment-proofs").getPublicUrl(path).data.publicUrl;
}

async function findStoredPaymentProof(order: Order) {
  if (orderProof(order)) return "";

  const customerId = orderCustomerId(order);
  if (!customerId) return "";

  const { data, error } = await supabase.storage.from("payment-proofs").list(customerId, {
    limit: 100,
    sortBy: { column: "created_at", order: "desc" },
  });

  if (error || !data) return "";

  const newestFile = (data as StoredPaymentProof[])
    .filter((file) => file.name.startsWith(`${order.id}-`))
    .sort((left, right) => {
      const leftTime = new Date(left.created_at || left.updated_at || 0).getTime();
      const rightTime = new Date(right.created_at || right.updated_at || 0).getTime();
      return rightTime - leftTime;
    })[0];

  return newestFile ? paymentProofUrlFromPath(`${customerId}/${newestFile.name}`) : "";
}

async function hydrateAdminOrdersWithStoredProofs(rawOrders: Order[]) {
  return Promise.all(
    rawOrders.map(async (order) => {
      const storedProof = await findStoredPaymentProof(order);
      return storedProof ? { ...order, payment_proof_url: storedProof, bukti_pembayaran: storedProof } : order;
    }),
  );
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

function isStatusConstraintError(errorMessage: string | undefined) {
  return Boolean(errorMessage?.includes("orders_status_check"));
}

function makeDraft(order: Order): Draft {
  return {
    shippingCost: orderOngkir(order) ? formatNumberInput(String(orderOngkir(order))) : "",
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
  const [couriers, setCouriers] = useState<CourierSetting[]>([]);
  const [filter, setFilter] = useState<FilterStatus>("semua");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");
  const [approvingOrder, setApprovingOrder] = useState<Order | null>(null);
  const [rejectingOrder, setRejectingOrder] = useState<Order | null>(null);

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
      await Promise.all([loadOrders(), loadCouriers()]);
      setLoading(false);
    }

    checkAccessAndLoad();
  }, [router]);

  async function loadOrders() {
    const { data } = await supabase.from("orders").select("*, order_items(*)").order("created_at", { ascending: false });

    if (data) {
      const nextOrders = await hydrateAdminOrdersWithStoredProofs(data as Order[]);
      setOrders(nextOrders);
      setDrafts(Object.fromEntries(nextOrders.map((order) => [order.id, makeDraft(order)])));
    }
  }

  async function loadCouriers() {
    const { data } = await supabase.from("courier_settings").select("id,name").order("name", { ascending: true });
    if (data) setCouriers(data as CourierSetting[]);
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
      continue;
    }

    if (
      isStatusConstraintError(error?.message) &&
      (adaptivePayload.status === "diproses" || adaptivePayload.status_pesanan === "diproses")
    ) {
      setMessage("Status Diproses belum diizinkan di database. Jalankan SQL order-workflow terbaru di Supabase terlebih dahulu.");
      setSavingId("");
      return false;
    }

    for (let attempt = 0; attempt < 5 && isStatusConstraintError(error?.message); attempt += 1) {
      delete adaptivePayload.status;
      delete adaptivePayload.status_pesanan;
      const result = await supabase.from("orders").update(adaptivePayload).eq("id", orderId);
      error = result.error;
    }

    if (error) {
      setMessage(error.message);
      setSavingId("");
      return false;
    }

    await loadOrders();
    setMessage(successMessage);
    setSavingId("");
    return true;
  }

  async function saveShipping(order: Order) {
    const draft = drafts[order.id];
    const shippingCost = parseNumberInput(draft?.shippingCost);
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
      return false;
    }

    return updateOrder(
      order.id,
      {
        status: "diproses",
        status_pesanan: "diproses",
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      "Pesanan berhasil diterima dan masuk status Diproses.",
    );
  }

  async function saveTracking(order: Order) {
    const draft = drafts[order.id];
    const status = normalizeStatus(order);
    const tracking = draft?.trackingNumber?.trim() || "";
    const selectedCourier = draft?.courierName?.trim() || "";

    if (status !== "diproses") {
      setMessage("Resi hanya bisa dikirim setelah pesanan berstatus Diproses.");
      return;
    }

    if (!tracking) {
      setMessage("Nomor resi wajib diisi sebelum kirim resi.");
      return;
    }

    if (!selectedCourier) {
      setMessage("Nama kurir wajib dipilih sebelum kirim resi.");
      return;
    }

    await updateOrder(
      order.id,
      {
        status: "pesanan_dikirim",
        status_pesanan: "pesanan_dikirim",
        tracking_number: tracking,
        nomor_resi: tracking,
        courier_name: selectedCourier,
        nama_kurir: selectedCourier,
        shipped_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      "Resi berhasil ditulis/input.",
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
      total: orders.length,
      menungguOngkir: orders.filter((order) => normalizeStatus(order) === "menunggu_ongkir").length,
      menungguPembayaran: orders.filter((order) => normalizeStatus(order) === "menunggu_pembayaran").length,
      menungguKonfirmasi: orders.filter((order) => normalizeStatus(order) === "menunggu_konfirmasi").length,
      proses: orders.filter((order) => normalizeStatus(order) === "diproses").length,
      sedangDikirim: orders.filter((order) => normalizeStatus(order) === "pesanan_dikirim").length,
      ditolak: orders.filter((order) => normalizeStatus(order) === "ditolak").length,
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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Pesanan Baru</p>
            <p className="mt-2 text-3xl font-bold">{counts.total}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Menunggu Ongkir</p>
            <p className="mt-2 text-3xl font-bold">{counts.menungguOngkir}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Menunggu Pembayaran</p>
            <p className="mt-2 text-3xl font-bold">{counts.menungguPembayaran}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Menunggu Konfirmasi</p>
            <p className="mt-2 text-3xl font-bold">{counts.menungguKonfirmasi}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Diproses</p>
            <p className="mt-2 text-3xl font-bold">{counts.proses}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Sedang Dikirim</p>
            <p className="mt-2 text-3xl font-bold">{counts.sedangDikirim}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Ditolak</p>
            <p className="mt-2 text-3xl font-bold">{counts.ditolak}</p>
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
                <option key={status} value={status}>{statusLabel(status)}</option>
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
            const courierOptions = draft.courierName && !couriers.some((courier) => courier.name === draft.courierName)
              ? [...couriers, { id: "current", name: draft.courierName }]
              : couriers;
            const needsAcceptedFirst = status !== "diproses";
            const canSendTracking = status === "diproses" && Boolean(draft.trackingNumber.trim()) && Boolean(draft.courierName.trim());
            const canVerifyOrder = status === "menunggu_konfirmasi";

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

                <div className="grid gap-4 p-5 xl:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 p-4">
                    <h3 className="font-bold">Detail Produk</h3>
                    <div className="mt-3 grid gap-2">
                      {order.order_items.map((item) => (
                        <div key={item.id} className="rounded-md bg-slate-50 px-3 py-2 text-sm">
                          <div className="flex justify-between gap-3">
                            <span>{itemName(item)} x {itemQty(item)}</span>
                            <strong>{formatCurrency(itemSubtotal(item))}</strong>
                          </div>
                          {itemNote(item) && <p className="mt-1 text-xs text-slate-500">Catatan: {itemNote(item)}</p>}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 p-4">
                    <h3 className="font-bold">Total Produk</h3>
                    <div className="mt-3 grid gap-2 text-sm">
                      <div className="flex justify-between"><span>Total Produk</span><strong>{formatCurrency(totalProduk)}</strong></div>
                      <div className="flex justify-between"><span>Ongkir</span><strong>{formatCurrency(ongkir)}</strong></div>
                      <div className="flex justify-between border-t border-slate-200 pt-2 text-base"><span>Grand Total</span><strong>{formatCurrency(grandTotal)}</strong></div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 p-4">
                    <h3 className="font-bold">Bukti Transfer</h3>
                    {proof ? (
                      <a href={proof} target="_blank" rel="noreferrer" className="mt-3 block w-28 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                        <img src={proof} alt="Bukti pembayaran customer" className="h-28 w-full object-contain" />
                      </a>
                    ) : (
                      <div className="mt-3 rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                        Belum ada bukti transfer.
                      </div>
                    )}
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

                  <div className="rounded-lg border border-slate-200 p-4">
                    <h3 className="font-bold">Ongkir & Nomor Resi</h3>
                    <div className="mt-3 grid gap-3">
                      <label className="grid grid-cols-[72px_1fr] items-center gap-3 text-sm font-bold text-slate-700">
                        Ongkir
                        <input
                          value={draft.shippingCost}
                          onChange={(event) => updateDraft(order.id, "shippingCost", formatNumberInput(event.target.value))}
                          inputMode="numeric"
                          placeholder="10.000"
                          className="min-w-0 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium outline-none focus:border-rose-400"
                        />
                      </label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-2 text-sm font-bold text-slate-700">
                          Nomor Resi
                          <input
                            value={draft.trackingNumber}
                            onChange={(event) => updateDraft(order.id, "trackingNumber", event.target.value)}
                            placeholder="Nomor resi"
                            className="min-w-0 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-rose-400"
                          />
                        </label>
                        <label className="grid gap-2 text-sm font-bold text-slate-700">
                          Nama Kurir
                          <select
                            value={draft.courierName}
                            onChange={(event) => updateDraft(order.id, "courierName", event.target.value)}
                            className="min-w-0 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-rose-400"
                          >
                            <option value="">Pilih kurir</option>
                            {courierOptions.map((courier) => (
                              <option key={courier.id} value={courier.name}>{courier.name}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <button
                          disabled={savingId === order.id}
                          onClick={() => saveShipping(order)}
                          className="rounded-md bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                        >
                          Simpan Ongkir
                        </button>
                        <button
                          disabled={savingId === order.id || !canSendTracking}
                          onClick={() => saveTracking(order)}
                          title={needsAcceptedFirst ? "Anda harus terima pesanan dulu." : undefined}
                          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                        >
                          Kirim Resi
                        </button>
                      </div>
                      {needsAcceptedFirst && (
                        <p className="text-xs font-semibold text-amber-700">Anda harus terima pesanan dulu sebelum input resi.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 p-4">
                    <h3 className="font-bold">Verifikasi Pesanan</h3>
                    <div className="mt-3 grid gap-3">
                      <button
                        disabled={savingId === order.id || !proof || !canVerifyOrder}
                        onClick={() => setApprovingOrder(order)}
                        title={!canVerifyOrder ? "Pesanan ini sudah tidak berada di tahap verifikasi." : undefined}
                        className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                      >
                        Terima Pesanan
                      </button>
                      <button
                        disabled={savingId === order.id || !canVerifyOrder}
                        onClick={() => setRejectingOrder(order)}
                        title={!canVerifyOrder ? "Pesanan ini sudah tidak berada di tahap verifikasi." : undefined}
                        className="rounded-md bg-rose-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                      >
                        Tolak Pesanan
                      </button>
                      {!canVerifyOrder && (
                        <p className="text-xs font-semibold text-slate-500">Verifikasi sudah selesai untuk pesanan ini.</p>
                      )}
                      <button
                        disabled={savingId === order.id}
                        onClick={() => deleteOrder(order)}
                        className="rounded-md border border-rose-200 bg-white px-4 py-2 text-sm font-bold text-rose-700 disabled:opacity-50"
                      >
                        Hapus Pesanan
                      </button>
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

        {approvingOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
            <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-xl font-black text-emerald-700">
                OK
              </div>
              <p className="mt-4 text-xs font-bold uppercase tracking-[0.25em] text-emerald-600">Terima Pesanan</p>
              <h2 className="mt-2 text-xl font-bold">Yakin menerima pesanan #{approvingOrder.id.slice(0, 8)}?</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Pastikan bukti transfer customer sudah benar. Jika diterima, status pesanan berubah menjadi Diproses dan kolom resi bisa digunakan.
              </p>
              <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">
                Total pembayaran: <strong>{formatCurrency(orderGrandTotal(approvingOrder))}</strong>
              </div>
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setApprovingOrder(null)}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700"
                >
                  Tidak
                </button>
                <button
                  type="button"
                  disabled={savingId === approvingOrder.id}
                  onClick={async () => {
                    const approved = await approvePayment(approvingOrder);
                    if (approved) setApprovingOrder(null);
                  }}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  {savingId === approvingOrder.id ? "Memproses..." : "Ya, Terima Pesanan"}
                </button>
              </div>
            </div>
          </div>
        )}

        {rejectingOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
            <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-rose-500">Tolak Pesanan</p>
              <h2 className="mt-2 text-xl font-bold">Pesanan #{rejectingOrder.id.slice(0, 8)}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Isi alasan penolakan agar customer bisa melihat kenapa pesanan ditolak.
              </p>
              <textarea
                value={(drafts[rejectingOrder.id] || makeDraft(rejectingOrder)).rejectReason}
                onChange={(event) => updateDraft(rejectingOrder.id, "rejectReason", event.target.value)}
                placeholder="Contoh: Bukti transfer belum sesuai dengan total pembayaran."
                rows={4}
                className="mt-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-rose-400"
              />
              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setRejectingOrder(null)}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={savingId === rejectingOrder.id}
                  onClick={async () => {
                    await rejectPayment(rejectingOrder);
                    setRejectingOrder(null);
                  }}
                  className="rounded-md bg-rose-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  Confirm Tolak
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
