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
  kurir?: string | null;
  shipping_courier?: string | null;
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

type FooterSettings = {
  store_name: string;
  address: string;
  whatsapp: string;
  email: string;
};

type PaymentSettings = {
  bank_name: string;
  account_number: string;
  account_holder: string;
  payment_logo_url: string;
};

type StoredPaymentProof = {
  name: string;
  created_at?: string | null;
  updated_at?: string | null;
};

const statuses: FilterStatus[] = ["semua", "menunggu_ongkir", "menunggu_pembayaran", "menunggu_konfirmasi", "diproses", "pesanan_dikirim", "ditolak"];
const defaultFooterSettings: FooterSettings = {
  store_name: "Tokoku",
  address: "",
  whatsapp: "",
  email: "",
};
const defaultPaymentSettings: PaymentSettings = {
  bank_name: "",
  account_number: "",
  account_holder: "",
  payment_logo_url: "",
};

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
  if (raw.includes("kirim") || raw.includes("dikirim") || trackingNumber(order)) return "pesanan_dikirim";
  if (raw.includes("proses") || raw.includes("diproses")) return "diproses";
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

function orderTotalQty(order: Order) {
  return (order.order_items || []).reduce((total, item) => total + itemQty(item), 0);
}

function orderFirstProductName(order: Order) {
  const firstItem = (order.order_items || [])[0];
  return firstItem ? itemName(firstItem) : "Produk";
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
  return firstText(order.courier_name, order.nama_kurir, order.kurir, order.shipping_courier);
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

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function updateOrderWithRequiredCourier(orderId: string, payload: Row, courierColumn: string) {
  const adaptivePayload = { ...payload };
  let error: { message: string } | null = null;
  let missingRequiredCourier = false;
  let savedOrder = null as Order | null;

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = await supabase.from("orders").update(adaptivePayload).eq("id", orderId).select("*").maybeSingle();
    error = result.error;
    savedOrder = result.data as Order | null;

    const missingColumn = getMissingColumn(error?.message);
    if (!missingColumn) break;

    if (missingColumn === courierColumn) {
      missingRequiredCourier = true;
      break;
    }

    delete adaptivePayload[missingColumn];
  }

  return { error, missingRequiredCourier, savedOrder };
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
  const [footerSettings, setFooterSettings] = useState<FooterSettings>(defaultFooterSettings);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(defaultPaymentSettings);
  const [filter, setFilter] = useState<FilterStatus>("semua");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");
  const [approvingOrder, setApprovingOrder] = useState<Order | null>(null);
  const [rejectingOrder, setRejectingOrder] = useState<Order | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

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
      await Promise.all([loadOrders(), loadCouriers(), loadFooterSettings(), loadPaymentSettings()]);
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

  async function loadFooterSettings() {
    const { data } = await supabase.from("footer_settings").select("store_name,address,whatsapp,email").eq("id", true).maybeSingle();
    if (data) setFooterSettings({ ...defaultFooterSettings, ...data });
  }

  async function loadPaymentSettings() {
    const { data } = await supabase.from("payment_settings").select("bank_name,account_number,account_holder,payment_logo_url").eq("id", true).maybeSingle();
    if (data) setPaymentSettings({ ...defaultPaymentSettings, ...data });
  }

  function toggleOrder(orderId: string) {
    setExpandedOrders((current) => ({ ...current, [orderId]: !current[orderId] }));
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

    if (!["diproses", "pesanan_dikirim"].includes(status)) {
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

    setSavingId(order.id);
    setMessage("");

    const courierColumns = ["courier_name", "nama_kurir", "kurir", "shipping_courier"];
    let lastError = null as { message: string } | null;

    for (const courierColumn of courierColumns) {
      const payload = {
        status: "pesanan_dikirim",
        status_pesanan: "pesanan_dikirim",
        tracking_number: tracking,
        nomor_resi: tracking,
        [courierColumn]: selectedCourier,
        shipped_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error, missingRequiredCourier, savedOrder } = await updateOrderWithRequiredCourier(order.id, payload, courierColumn);
      lastError = error;

      if (isStatusConstraintError(error?.message)) {
        setMessage("Status Sedang Dikirim belum diizinkan di database. Jalankan SQL order-workflow terbaru di Supabase terlebih dahulu.");
        setSavingId("");
        return;
      }

      const trackingSaved = savedOrder ? trackingNumber(savedOrder) === tracking : false;
      const courierSaved = savedOrder ? courierName(savedOrder) === selectedCourier : false;
      const shippedSaved = savedOrder ? normalizeStatus(savedOrder) === "pesanan_dikirim" : false;

      if (!error && !missingRequiredCourier && trackingSaved && courierSaved && shippedSaved) {
        await loadOrders();
        setDrafts((current) => ({
          ...current,
          [order.id]: {
            ...(current[order.id] || makeDraft(order)),
            trackingNumber: tracking,
            courierName: selectedCourier,
          },
        }));
        setMessage(`Resi dan nama kurir ${selectedCourier} berhasil disimpan. Status pesanan menjadi Sedang Dikirim.`);
        setSavingId("");
        return;
      }

      if (!error && !missingRequiredCourier) {
        lastError = {
          message: "Data resi belum tersimpan sempurna. Pastikan kolom tracking_number, courier_name, dan status tersedia di tabel orders.",
        };
      }
    }

    setMessage(lastError?.message || "Nama kurir belum bisa disimpan. Jalankan SQL order-workflow terbaru di Supabase agar kolom courier_name tersedia.");
    setSavingId("");
  }

  function printShippingLabel(order: Order) {
    const resi = trackingNumber(order);
    const courier = courierName(order);
    const storeName = footerSettings.store_name || defaultFooterSettings.store_name;
    const storeAddress = footerSettings.address || "";
    const productRows = (order.order_items || [])
      .map((item) => `<div class="product-row"><span>${escapeHtml(itemName(item))}</span><strong>x ${itemQty(item)}</strong></div>`)
      .join("");
    const barcodeBars = Array.from(resi || "0")
      .map((char, index) => {
        const width = ((char.charCodeAt(0) + index) % 4) + 1;
        return `<span style="width:${width}px"></span>`;
      })
      .join("");

    if (!resi) {
      setMessage("Nomor resi belum ada, label belum bisa dicetak.");
      return;
    }

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Label ${escapeHtml(order.id.slice(0, 8))}</title>
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; font-family: Arial, sans-serif; color: #0f172a; }
            .label { width: 100mm; min-height: 150mm; padding: 10mm; border: 1px solid #cbd5e1; }
            .title { font-size: 22px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; }
            .store-address { margin-top: 4px; font-size: 12px; line-height: 1.5; color: #475569; white-space: pre-wrap; }
            .divider { border-top: 2px solid #0f172a; margin-top: 10px; }
            .section { margin-top: 12px; }
            .small { font-size: 11px; color: #475569; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
            .value { margin-top: 4px; font-size: 15px; font-weight: 800; line-height: 1.4; }
            .product-row { display: flex; justify-content: space-between; gap: 12px; border-bottom: 1px solid #e2e8f0; padding: 7px 0; font-size: 13px; }
            .person-box { border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px; font-size: 12px; line-height: 1.5; }
            .resi { margin-top: 8px; border: 2px solid #0f172a; padding: 10px; text-align: center; font-size: 22px; font-weight: 900; letter-spacing: 1px; }
            .barcode { margin-top: 10px; display: flex; align-items: stretch; justify-content: center; gap: 2px; height: 58px; border: 1px solid #cbd5e1; padding: 8px; }
            .barcode span { display: block; background: #0f172a; height: 100%; }
            @media print {
              body { margin: 0; }
              .label { border: 0; width: auto; min-height: auto; }
            }
          </style>
        </head>
        <body>
          <main class="label">
            <div class="title">${escapeHtml(storeName)}</div>
            ${storeAddress ? `<div class="store-address">${escapeHtml(storeAddress)}</div>` : ""}
            <div class="divider"></div>
            <div class="section">
              <div class="small">Detail Produk</div>
              ${productRows || `<div class="product-row"><span>Produk</span><strong>x 0</strong></div>`}
            </div>
            <div class="section">
              <div class="small">Pengirim</div>
              <div class="person-box">
                <strong>${escapeHtml(storeName)}</strong><br />
                ${escapeHtml(storeAddress || "-")}<br />
                WhatsApp: ${escapeHtml(footerSettings.whatsapp || "-")}
              </div>
            </div>
            <div class="section">
              <div class="small">Penerima</div>
              <div class="person-box">
                <strong>${escapeHtml(orderName(order) || "-")}</strong><br />
                WhatsApp: ${escapeHtml(orderPhone(order) || "-")}<br />
                ${escapeHtml(orderAddress(order) || "-")}<br />
                ${orderMaps(order) ? `Maps: ${escapeHtml(orderMaps(order))}` : ""}
              </div>
            </div>
            <div class="section">
              <div class="small">Nomor Resi</div>
              <div class="resi">${escapeHtml(resi)}</div>
              <div class="barcode">${barcodeBars}</div>
            </div>
            <div class="section">
              <div class="small">Nama Kurir</div>
              <div class="value">${escapeHtml(courier || "-")}</div>
            </div>
          </main>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "width=520,height=720");
    if (!printWindow) {
      setMessage("Popup print diblokir browser. Izinkan popup untuk mencetak label.");
      return;
    }

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 400);
  }

  function printAdminInvoice(order: Order) {
    const status = normalizeStatus(order);
    const isPaid = status === "pesanan_dikirim";
    const proof = orderProof(order);
    const totalProduk = orderTotalProduk(order);
    const ongkir = orderOngkir(order);
    const grandTotal = orderGrandTotal(order);
    const resi = trackingNumber(order);
    const storeName = footerSettings.store_name || defaultFooterSettings.store_name;
    const invoiceNumber = `INV-${order.id.slice(0, 8).toUpperCase()}`;
    const productRows = (order.order_items || [])
      .map((item) => {
        const note = itemNote(item);
        return `
          <tr>
            <td>
              <strong>${escapeHtml(itemName(item))}</strong>
              ${note ? `<div class="muted">Catatan: ${escapeHtml(note)}</div>` : ""}
            </td>
            <td class="center">${itemQty(item)}</td>
            <td class="right">${formatCurrency(itemPrice(item))}</td>
            <td class="right">${formatCurrency(itemSubtotal(item))}</td>
          </tr>
        `;
      })
      .join("");

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(invoiceNumber)}</title>
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; background: #f8fafc; color: #0f172a; font-family: Arial, sans-serif; }
            .invoice { position: relative; width: 210mm; min-height: 297mm; margin: 0 auto; background: white; padding: 24mm 18mm; overflow: hidden; }
            .watermark { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 0; }
            .watermark span { transform: rotate(-18deg); font-size: 84px; font-weight: 900; letter-spacing: 8px; opacity: .3; color: ${isPaid ? "#16a34a" : "#dc2626"}; }
            .content { position: relative; z-index: 1; }
            .header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #0f172a; padding-bottom: 18px; }
            .brand { font-size: 28px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; }
            .meta { text-align: right; line-height: 1.6; }
            .small { font-size: 12px; color: #475569; line-height: 1.6; }
            .muted { margin-top: 4px; font-size: 12px; color: #64748b; }
            h2 { margin: 24px 0 10px; font-size: 15px; text-transform: uppercase; letter-spacing: 2px; color: #f43f5e; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th { background: #fff1f2; color: #0f172a; text-align: left; font-size: 12px; padding: 10px; border: 1px solid #fecdd3; }
            td { padding: 10px; border: 1px solid #e2e8f0; vertical-align: top; font-size: 13px; }
            .right { text-align: right; }
            .center { text-align: center; }
            .summary { margin-left: auto; width: 45%; margin-top: 12px; }
            .summary td { border-color: #fecdd3; }
            .summary .grand td { font-size: 16px; font-weight: 900; background: #fff1f2; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 12px; }
            .box { border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; min-height: 110px; }
            .proof { max-width: 220px; max-height: 160px; object-fit: contain; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px; }
            .bank { display: flex; gap: 12px; align-items: flex-start; }
            .bank img { width: 64px; height: 44px; object-fit: contain; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px; }
            @media print {
              body { background: white; }
              .invoice { margin: 0; width: auto; min-height: auto; box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <main class="invoice">
            <div class="watermark"><span>${isPaid ? "LUNAS" : "BELUM LUNAS"}</span></div>
            <div class="content">
              <section class="header">
                <div>
                  <div class="brand">${escapeHtml(storeName)}</div>
                  ${footerSettings.address ? `<div class="small">${escapeHtml(footerSettings.address)}</div>` : ""}
                  ${footerSettings.whatsapp ? `<div class="small">WhatsApp: ${escapeHtml(footerSettings.whatsapp)}</div>` : ""}
                  ${footerSettings.email ? `<div class="small">Email: ${escapeHtml(footerSettings.email)}</div>` : ""}
                </div>
                <div class="meta">
                  <strong>${escapeHtml(invoiceNumber)}</strong><br />
                  <span class="small">${new Date(order.created_at).toLocaleString("id-ID")}</span><br />
                  <span class="small">Status: ${escapeHtml(statusLabel(status))}</span>
                </div>
              </section>

            <h2>Detail Produk</h2>
            <table>
              <thead>
                <tr>
                  <th>Produk</th>
                  <th class="center">Qty</th>
                  <th class="right">Harga</th>
                  <th class="right">Subtotal</th>
                </tr>
              </thead>
              <tbody>${productRows}</tbody>
            </table>
            <table class="summary">
              <tbody>
                <tr><td>Total Produk</td><td class="right">${formatCurrency(totalProduk)}</td></tr>
                <tr><td>Ongkir</td><td class="right">${formatCurrency(ongkir)}</td></tr>
                <tr class="grand"><td>Total Harga</td><td class="right">${formatCurrency(grandTotal)}</td></tr>
              </tbody>
            </table>

            <div class="grid">
              <section class="box">
                <h2>Bukti Pembayaran</h2>
                ${proof ? `<img class="proof" src="${escapeHtml(proof)}" alt="Bukti pembayaran" />` : `<p class="small">Belum ada bukti pembayaran.</p>`}
              </section>
              <section class="box">
                <h2>Penerima & Resi</h2>
                <div class="small">Nama: ${escapeHtml(orderName(order) || "-")}</div>
                <div class="small">WhatsApp: ${escapeHtml(orderPhone(order) || "-")}</div>
                <div class="small">Alamat: ${escapeHtml(orderAddress(order) || "-")}</div>
                ${orderMaps(order) ? `<div class="small">Maps: ${escapeHtml(orderMaps(order))}</div>` : ""}
                <div class="small">Nomor Resi: ${escapeHtml(resi || "Nomor resi belum ada")}</div>
                ${courierName(order) ? `<div class="small">Kurir: ${escapeHtml(courierName(order))}</div>` : ""}
                ${trackingUrl(order) ? `<div class="small">Tracking: ${escapeHtml(trackingUrl(order))}</div>` : ""}
              </section>
            </div>

            <section class="box" style="margin-top: 14px;">
              <h2>Rekening Resmi</h2>
              <div class="bank">
                ${paymentSettings.payment_logo_url ? `<img src="${escapeHtml(paymentSettings.payment_logo_url)}" alt="${escapeHtml(paymentSettings.bank_name)}" />` : ""}
                <div class="small">
                  <strong>${escapeHtml(paymentSettings.bank_name || "Rekening belum diatur")}</strong><br />
                  Nomor rekening: ${escapeHtml(paymentSettings.account_number || "-")}<br />
                  Atas nama: ${escapeHtml(paymentSettings.account_holder || "-")}
                </div>
              </div>
            </section>
            </div>
          </main>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      setMessage("Popup print diblokir browser. Izinkan popup untuk melihat invoice.");
      return;
    }

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
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

  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesStatus = filter === "semua" || normalizeStatus(order) === filter;
      const matchesSearch = !query
        || order.id.toLowerCase().includes(query)
        || order.id.slice(0, 8).toLowerCase().includes(query)
        || orderName(order).toLowerCase().includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [orders, filter, searchQuery]);

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

        <div className="mt-6 grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_280px]">
          <label className="grid gap-2 text-sm font-bold">
            Cari Pesanan
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Cari nomor invoice atau nama customer..."
              className="rounded-md border border-slate-300 px-3 py-2 font-medium outline-none focus:border-rose-400"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold">
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
            const currentResi = trackingNumber(order);
            const courierOptions = draft.courierName && !couriers.some((courier) => courier.name === draft.courierName)
              ? [...couriers, { id: "current", name: draft.courierName }]
              : couriers;
            const needsAcceptedFirst = !["diproses", "pesanan_dikirim"].includes(status);
            const canSendTracking = !needsAcceptedFirst && Boolean(draft.trackingNumber.trim()) && Boolean(draft.courierName.trim());
            const canPrintLabel = Boolean(currentResi);
            const canVerifyOrder = status === "menunggu_konfirmasi";
            const isExpanded = expandedOrders[order.id] ?? false;
            const totalQty = orderTotalQty(order);
            const firstProductName = orderFirstProductName(order);

            return (
              <article key={order.id} className="rounded-lg border border-slate-200 bg-white shadow-sm">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleOrder(order.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      toggleOrder(order.id);
                    }
                  }}
                  className="flex cursor-pointer flex-col gap-3 border-b border-slate-200 px-5 py-4 transition hover:bg-slate-50 lg:flex-row lg:items-start lg:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.25em] text-rose-500">
                      {new Date(order.created_at).toLocaleString("id-ID")}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h2 className="text-xl font-bold">Pesanan #{order.id.slice(0, 8)}</h2>
                      <span className="text-sm font-semibold text-slate-600">{firstProductName} - {totalQty} barang</span>
                      <span className="text-sm font-bold text-slate-950">{formatCurrency(totalProduk)}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{orderName(order) || "-"} - {orderPhone(order) || "-"}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2" onClick={(event) => event.stopPropagation()}>
                    <span className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${statusClass(status)}`}>
                      {statusLabel(status)}
                    </span>
                    <button
                      type="button"
                      onClick={() => printAdminInvoice(order)}
                      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700"
                    >
                      Lihat Invoice
                    </button>
                    <button
                      type="button"
                      disabled={!canPrintLabel}
                      onClick={() => printShippingLabel(order)}
                      title={!canPrintLabel ? "Nomor resi belum ada." : undefined}
                      className="rounded-md bg-slate-950 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                    >
                      Cetak Label
                    </button>
                  </div>
                </div>

                {isExpanded && (
                <div className="grid gap-4 p-5 xl:grid-cols-[3fr_2fr_1fr]">
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
                )}
              </article>
            );
          })}
        </div>

        {filteredOrders.length === 0 && (
          <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-white px-5 py-10 text-center text-sm text-slate-500">
            Belum ada pesanan yang cocok dengan filter atau pencarian ini.
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
