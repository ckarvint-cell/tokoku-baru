"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Status = "menunggu_ongkir" | "menunggu_pembayaran" | "menunggu_konfirmasi" | "diproses" | "pesanan_dikirim" | "ditolak";
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

type FooterSettings = {
  store_name: string;
  address: string;
  whatsapp: string;
  email: string;
  instagram: string;
  copyright_text: string;
};

type StoredPaymentProof = {
  name: string;
  created_at?: string | null;
  updated_at?: string | null;
};

const defaultPaymentSettings: PaymentSettings = {
  bank_name: "",
  account_number: "",
  account_holder: "",
  payment_logo_url: "",
  payment_note: "",
};

const defaultFooterSettings: FooterSettings = {
  store_name: "Tokoku",
  address: "",
  whatsapp: "",
  email: "",
  instagram: "",
  copyright_text: "",
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

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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

function statusLabel(status: Status) {
  if (status === "menunggu_ongkir") return "menunggu ongkir";
  if (status === "menunggu_pembayaran") return "menunggu pembayaran";
  if (status === "menunggu_konfirmasi") return "menunggu konfirmasi";
  if (status === "diproses") return "diproses";
  if (status === "pesanan_dikirim") return "sedang dikirim";
  return "ditolak";
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

function getPaymentProofPath(publicUrl: string) {
  const marker = "/payment-proofs/";
  const index = publicUrl.indexOf(marker);
  if (index === -1) return "";
  return decodeURIComponent(publicUrl.slice(index + marker.length).split("?")[0]);
}

function getMissingColumn(errorMessage: string | undefined) {
  return errorMessage?.match(/Could not find the '([^']+)' column/)?.[1] || "";
}

function paymentProofUrlFromPath(path: string) {
  return supabase.storage.from("payment-proofs").getPublicUrl(path).data.publicUrl;
}

async function listStoredPaymentProofs(customerId: string, orderId: string) {
  const { data, error } = await supabase.storage.from("payment-proofs").list(customerId, {
    limit: 100,
    sortBy: { column: "created_at", order: "desc" },
  });

  if (error || !data) return [];

  return (data as StoredPaymentProof[])
    .filter((file) => file.name.startsWith(`${orderId}-`))
    .sort((left, right) => {
      const leftTime = new Date(left.created_at || left.updated_at || 0).getTime();
      const rightTime = new Date(right.created_at || right.updated_at || 0).getTime();
      return rightTime - leftTime;
    })
    .map((file) => `${customerId}/${file.name}`);
}

async function hydrateOrdersWithStoredProofs(rawOrders: Order[], customerId: string) {
  const { data, error } = await supabase.storage.from("payment-proofs").list(customerId, {
    limit: 100,
    sortBy: { column: "created_at", order: "desc" },
  });

  if (error || !data) return rawOrders;

  const files = data as StoredPaymentProof[];

  return rawOrders.map((order) => {
    if (orderProof(order)) return order;

    const newestFile = files
      .filter((file) => file.name.startsWith(`${order.id}-`))
      .sort((left, right) => {
        const leftTime = new Date(left.created_at || left.updated_at || 0).getTime();
        const rightTime = new Date(right.created_at || right.updated_at || 0).getTime();
        return rightTime - leftTime;
      })[0];

    if (!newestFile) return order;

    const publicUrl = paymentProofUrlFromPath(`${customerId}/${newestFile.name}`);
    return { ...order, payment_proof_url: publicUrl, bukti_pembayaran: publicUrl };
  });
}

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(defaultPaymentSettings);
  const [footerSettings, setFooterSettings] = useState<FooterSettings>(defaultFooterSettings);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [uploadingId, setUploadingId] = useState("");

  async function removeOldPaymentProofs(orderId: string, keepPath: string, previousProof: string) {
    const storedPaths = await listStoredPaymentProofs(userId, orderId);
    const previousPath = previousProof ? getPaymentProofPath(previousProof) : "";
    const uniquePaths = Array.from(new Set([...storedPaths, previousPath].filter(Boolean)));
    const pathsToRemove = uniquePaths.filter((storedPath) => storedPath !== keepPath);

    if (pathsToRemove.length > 0) {
      await supabase.storage.from("payment-proofs").remove(pathsToRemove);
    }
  }

  useEffect(() => {
    async function loadData() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        router.push("/login");
        return;
      }

      setUserId(user.id);

      const [ordersResult, paymentResult, footerResult] = await Promise.all([
        supabase
          .from("orders")
          .select("*, order_items(*)")
          .or(`customer_id.eq.${user.id},user_id.eq.${user.id}`)
          .order("created_at", { ascending: false }),
        supabase.from("payment_settings").select("bank_name,account_number,account_holder,payment_logo_url,payment_note").eq("id", true).maybeSingle(),
        supabase.from("footer_settings").select("store_name,address,whatsapp,email,instagram,copyright_text").eq("id", true).maybeSingle(),
      ]);

      if (ordersResult.error?.message.includes("customer_id")) {
        const fallbackOrders = await supabase.from("orders").select("*, order_items(*)").eq("user_id", user.id).order("created_at", { ascending: false });
        if (fallbackOrders.data) setOrders(await hydrateOrdersWithStoredProofs(fallbackOrders.data as Order[], user.id));
      } else if (ordersResult.error?.message.includes("user_id")) {
        const fallbackOrders = await supabase.from("orders").select("*, order_items(*)").eq("customer_id", user.id).order("created_at", { ascending: false });
        if (fallbackOrders.data) setOrders(await hydrateOrdersWithStoredProofs(fallbackOrders.data as Order[], user.id));
      } else if (ordersResult.data) {
        setOrders(await hydrateOrdersWithStoredProofs(ordersResult.data as Order[], user.id));
      }

      if (paymentResult.data) setPaymentSettings({ ...defaultPaymentSettings, ...paymentResult.data });
      if (footerResult.data) setFooterSettings({ ...defaultFooterSettings, ...footerResult.data });
      const checkoutSuccess = window.sessionStorage.getItem("checkout_success");
      if (checkoutSuccess) {
        setMessageType("success");
        setMessage(checkoutSuccess);
        window.sessionStorage.removeItem("checkout_success");
      }
      setLoading(false);
    }

    loadData();
  }, [router]);

  async function savePaymentProofDirectly(orderId: string, proofUrl: string) {
    const payload: Row = {
      payment_proof_url: proofUrl,
      bukti_pembayaran: proofUrl,
      bukti_transfer: proofUrl,
      proof_url: proofUrl,
      payment_receipt_url: proofUrl,
      receipt_url: proofUrl,
      status: "menunggu_konfirmasi",
      status_pesanan: "menunggu_konfirmasi",
      updated_at: new Date().toISOString(),
    };

    let error: { message: string } | null = null;
    let savedOrder = null as Order | null;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const result = await supabase.from("orders").update(payload).eq("id", orderId).select("*").maybeSingle();
      error = result.error;
      savedOrder = result.data as Order | null;

      const missingColumn = getMissingColumn(error?.message);
      if (!missingColumn) break;

      delete payload[missingColumn];
    }

    return { error, savedOrder };
  }

  async function uploadPaymentProof(order: Order, file: File | undefined) {
    if (!file || !userId || uploadingId) return;

    setMessage("");
    setMessageType("success");
    setUploadingId(order.id);

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${userId}/${order.id}-${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("payment-proofs").upload(path, file, { upsert: false });

    if (uploadError) {
      setMessageType("error");
      setMessage(uploadError.message);
      setUploadingId("");
      return;
    }

    const { data } = supabase.storage.from("payment-proofs").getPublicUrl(path);
    const { data: latestOrderData } = await supabase.from("orders").select("*").eq("id", order.id).maybeSingle();
    const latestOrder = latestOrderData as Order | null;
    const previousProof = orderProof(latestOrder || order);
    const rpcResult = await supabase.rpc("customer_upload_payment_proof", {
      order_id_to_update: order.id,
      proof_url: data.publicUrl,
    });

    if (rpcResult.error) {
      const directResult = await savePaymentProofDirectly(order.id, data.publicUrl);
      if (directResult.error) {
        await supabase.storage.from("payment-proofs").remove([path]);
        setMessageType("error");
        setMessage(`Bukti berhasil diupload, tetapi gagal disimpan ke database: ${directResult.error.message || rpcResult.error.message}`);
        setUploadingId("");
        return;
      }

      if (directResult.savedOrder && orderProof(directResult.savedOrder)) {
        const updatedOrder = { ...order, ...directResult.savedOrder, order_items: order.order_items };
        setOrders((current) => current.map((item) => (item.id === order.id ? updatedOrder : item)));
        await removeOldPaymentProofs(order.id, path, previousProof);
        setMessageType("success");
        setMessage(previousProof ? "Bukti pembayaran berhasil diganti. Admin akan melakukan verifikasi." : "Bukti pembayaran berhasil diupload. Admin akan melakukan verifikasi.");
        setUploadingId("");
        return;
      }
    }

    const { data: refreshedOrder, error: refreshError } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", order.id)
      .maybeSingle();

    const updatedOrder = refreshedOrder as Order | null;

    if (refreshError) {
      setMessageType("error");
      setMessage(`Bukti sudah dikirim, tetapi pesanan gagal dimuat ulang: ${refreshError.message}`);
      setUploadingId("");
      return;
    }

    if (!updatedOrder || !orderProof(updatedOrder)) {
      const fallbackOrder = {
        ...order,
        payment_proof_url: data.publicUrl,
        bukti_pembayaran: data.publicUrl,
        status: "menunggu_konfirmasi",
        status_pesanan: "menunggu_konfirmasi",
      };
      setOrders((current) => current.map((item) => (item.id === order.id ? fallbackOrder : item)));
      await removeOldPaymentProofs(order.id, path, previousProof);
      setMessageType("success");
      setMessage(previousProof ? "Bukti pembayaran berhasil diganti. Admin akan melakukan verifikasi." : "Bukti pembayaran berhasil diupload. Admin akan melakukan verifikasi.");
      setUploadingId("");
      return;
    }

    setOrders((current) => current.map((item) => (item.id === order.id ? { ...item, ...updatedOrder } : item)));
    await removeOldPaymentProofs(order.id, path, previousProof);

    setMessageType("success");
    setMessage(previousProof ? "Bukti pembayaran berhasil diganti. Admin akan melakukan verifikasi." : "Bukti pembayaran berhasil diupload. Admin akan melakukan verifikasi.");
    setUploadingId("");
  }

  function copyTrackingNumber(resi: string) {
    navigator.clipboard.writeText(resi);
    setMessage("Nomor resi berhasil dicopy.");
  }

  function printInvoice(order: Order) {
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
      setMessageType("error");
      setMessage("Popup print diblokir browser. Izinkan popup untuk mencetak invoice.");
      return;
    }

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
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

      <section className="mx-auto max-w-6xl px-5 py-5">
        {message && (
          <div className={`mb-5 rounded-lg border px-4 py-3 text-sm font-medium ${
            messageType === "error"
              ? "border-rose-200 bg-rose-50 text-rose-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}>
            {message}
          </div>
        )}

        <div className="grid gap-3">
          {orders.map((order) => {
            const status = normalizeStatus(order);
            const proof = orderProof(order);
            const totalProduk = orderTotalProduk(order);
            const ongkir = orderOngkir(order);
            const grandTotal = orderGrandTotal(order);
            const resi = trackingNumber(order);
            const logo = courierLogo(order);
            const canUploadProof = status === "menunggu_pembayaran" || status === "menunggu_konfirmasi";

            return (
              <article key={order.id} className="rounded-lg border border-rose-100 bg-white shadow-sm">
                <div className="flex flex-col gap-2 border-b border-rose-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-rose-500">
                      {new Date(order.created_at).toLocaleString("id-ID")}
                    </p>
                    <h2 className="mt-0.5 text-lg font-bold">Pesanan #{order.id.slice(0, 8)}</h2>
                  </div>
                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    <span className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${statusClass(status)}`}>
                      {statusLabel(status)}
                    </span>
                    <button
                      type="button"
                      onClick={() => printInvoice(order)}
                      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-rose-300 hover:text-rose-600"
                    >
                      Print Invoice
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 p-4 lg:grid-cols-[3fr_2fr_1fr]">
                  <div className="rounded-lg border border-slate-200 p-3">
                    <h3 className="text-sm font-bold">Detail Produk</h3>
                    <div className="mt-2 grid gap-1.5">
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

                  <div className="rounded-lg border border-slate-200 p-3">
                    <h3 className="text-sm font-bold">Pembayaran</h3>
                    <div className="mt-2 grid gap-1.5 text-sm">
                      <div className="flex justify-between"><span>Total Produk</span><strong>{formatCurrency(totalProduk)}</strong></div>
                      <div className="flex justify-between"><span>Ongkir</span><strong>{formatCurrency(ongkir)}</strong></div>
                      <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base font-bold">
                        <span>Total Pembayaran</span><strong>{formatCurrency(grandTotal)}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-bold text-emerald-950">Bukti Pembayaran</h3>
                      {proof && <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-700">Tersimpan</span>}
                    </div>
                    {proof ? (
                      <a href={proof} target="_blank" rel="noreferrer" className="mt-2 block w-24 overflow-hidden rounded-md border border-emerald-100 bg-white">
                        <img src={proof} alt="Bukti pembayaran" className="h-24 w-full object-contain" />
                      </a>
                    ) : (
                      <div className="mt-2 flex h-24 w-24 items-center justify-center rounded-md border border-dashed border-emerald-200 bg-white px-2 text-center text-xs font-medium text-emerald-700">
                        Belum ada bukti
                      </div>
                    )}
                    {canUploadProof && (
                      <label className="mt-3 block">
                        <input
                          type="file"
                          accept="image/*"
                          disabled={uploadingId === order.id}
                          onChange={async (event) => {
                            await uploadPaymentProof(order, event.target.files?.[0]);
                            event.currentTarget.value = "";
                          }}
                          className="w-full rounded-md border border-emerald-200 bg-white px-2 py-2 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-rose-100 file:px-3 file:py-2 file:text-xs file:font-bold file:text-rose-700"
                        />
                      </label>
                    )}
                  </div>

                  <div className="rounded-lg border border-slate-200 p-3 text-sm leading-5 text-slate-600">
                    <h3 className="mb-1 font-bold text-slate-950">Penerima</h3>
                    <p className="truncate">Nama: {orderName(order) || "-"}</p>
                    <p className="truncate">WhatsApp: {orderPhone(order) || "-"}</p>
                    <p className="line-clamp-2">Alamat: {orderAddress(order) || "-"}</p>
                    {orderMaps(order) && (
                      <a href={orderMaps(order)} target="_blank" rel="noreferrer" className="mt-1 inline-flex font-bold text-rose-600">
                        Buka Google Maps
                      </a>
                    )}
                  </div>

                  <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
                    {status === "menunggu_ongkir" && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-800">
                        Admin sedang menentukan ongkir. Upload bukti pembayaran akan aktif setelah ongkir disimpan.
                      </div>
                    )}

                    {(status === "menunggu_pembayaran" || proof) && (
                      <>
                        <div className="flex items-start gap-3">
                          {paymentSettings.payment_logo_url && (
                            <img src={paymentSettings.payment_logo_url} alt={paymentSettings.bank_name} className="h-10 w-14 rounded-md bg-white object-contain p-2" />
                          )}
                          <div className="text-sm leading-5">
                            <h3 className="font-bold text-slate-950">{paymentSettings.bank_name || "Rekening belum diatur"}</h3>
                            <p>No. Rekening: <strong>{paymentSettings.account_number || "-"}</strong></p>
                            <p>Atas Nama: <strong>{paymentSettings.account_holder || "-"}</strong></p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="rounded-lg border border-slate-200 p-3 text-sm leading-5 text-slate-600">
                    <h3 className="mb-1 font-bold text-slate-950">Nomor Resi</h3>
                    {resi ? (
                      <div className="grid gap-2">
                        <p>Nomor resi: <strong className="text-slate-950">{resi}</strong></p>
                        <button onClick={() => copyTrackingNumber(resi)} className="w-fit rounded-md border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700">
                          Copy Resi
                        </button>
                        <p className="font-bold text-slate-950">{courierName(order) || "-"}</p>
                      </div>
                    ) : (
                      <p>Nomor resi belum ada</p>
                    )}
                  </div>

                    {status === "ditolak" && (
                      <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm leading-5 text-rose-800 lg:col-span-3">
                        <strong>Pembayaran ditolak.</strong>
                        <p>{firstText(order.payment_rejected_reason, order.alasan_penolakan) || "Admin belum memberi alasan."}</p>
                      </div>
                    )}

                    {status === "pesanan_dikirim" && (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 lg:col-span-3">
                        <div className="flex items-start gap-3">
                          {logo && <img src={logo} alt={courierName(order) || "Logo kurir"} className="h-12 w-16 rounded-md bg-white object-contain p-2" />}
                          <div>
                            <h3 className="font-bold text-emerald-950">{courierName(order) || "Kurir"}</h3>
                            <p className="text-sm text-emerald-800">Resi: <strong>{resi || "-"}</strong></p>
                          </div>
                        </div>
                        {resi && (
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(resi)}`}
                            alt="QR Code Resi"
                            className="mt-4 h-32 w-32 rounded-md bg-white p-2"
                          />
                        )}
                        <div className="mt-4 flex flex-wrap gap-2">
                          {resi && (
                            <button onClick={() => copyTrackingNumber(resi)} className="rounded-md bg-white px-4 py-2 text-sm font-bold text-emerald-700">
                              Copy Resi
                            </button>
                          )}
                          {trackingUrl(order) && (
                            <a href={trackingUrl(order)} target="_blank" rel="noreferrer" className="rounded-md bg-slate-950 px-4 py-2 text-sm font-bold text-white">
                              Cek Resi
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
              </article>
            );
          })}
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
