"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Status = "menunggu_ongkir" | "menunggu_pembayaran" | "pesanan_dikirim" | "ditolak";
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

const officialPaymentWarning =
  "Transfer sesuai Grand Total hanya ke rekening resmi di bawah ini. Pembayaran di luar rekening resmi toko tidak menjadi tanggung jawab kami. Setelah transfer berhasil, upload bukti pembayaran pada pesanan ini.";

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
  if (raw.includes("tolak")) return "ditolak";
  if (raw.includes("kirim") || raw.includes("dikirim") || trackingNumber(order) || order.paid_at) return "pesanan_dikirim";
  if (orderOngkir(order) <= 0) return "menunggu_ongkir";
  return "menunggu_pembayaran";
}

function statusLabel(status: Status) {
  if (status === "menunggu_ongkir") return "menunggu ongkir";
  if (status === "menunggu_pembayaran") return "menunggu pembayaran";
  if (status === "pesanan_dikirim") return "sedang dikirim";
  return "ditolak";
}

function statusClass(status: Status) {
  if (status === "menunggu_ongkir") return "bg-amber-50 text-amber-700 border-amber-200";
  if (status === "menunggu_pembayaran") return "bg-sky-50 text-sky-700 border-sky-200";
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

      const [ordersResult, paymentResult] = await Promise.all([
        supabase
          .from("orders")
          .select("*, order_items(*)")
          .or(`customer_id.eq.${user.id},user_id.eq.${user.id}`)
          .order("created_at", { ascending: false }),
        supabase.from("payment_settings").select("bank_name,account_number,account_holder,payment_logo_url,payment_note").eq("id", true).maybeSingle(),
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
          <div className={`mb-5 rounded-lg border px-4 py-3 text-sm font-medium ${
            messageType === "error"
              ? "border-rose-200 bg-rose-50 text-rose-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}>
            {message}
          </div>
        )}

        <div className="grid gap-5">
          {orders.map((order) => {
            const status = normalizeStatus(order);
            const proof = orderProof(order);
            const totalProduk = orderTotalProduk(order);
            const ongkir = orderOngkir(order);
            const grandTotal = orderGrandTotal(order);
            const resi = trackingNumber(order);
            const logo = courierLogo(order);

            return (
              <article key={order.id} className="rounded-lg border border-rose-100 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-rose-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.25em] text-rose-500">
                      {new Date(order.created_at).toLocaleString("id-ID")}
                    </p>
                    <h2 className="mt-1 text-xl font-bold">Pesanan #{order.id.slice(0, 8)}</h2>
                  </div>
                  <span className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${statusClass(status)}`}>
                    {statusLabel(status)}
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
                              <span>{itemName(item)} x {itemQty(item)}</span>
                              <strong>{formatCurrency(itemSubtotal(item))}</strong>
                            </div>
                            {itemNote(item) && <p className="mt-1 text-xs text-slate-500">Catatan: {itemNote(item)}</p>}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 p-4 text-sm leading-6 text-slate-600">
                      <h3 className="mb-2 font-bold text-slate-950">Penerima</h3>
                      <p>Nama: {orderName(order) || "-"}</p>
                      <p>WhatsApp: {orderPhone(order) || "-"}</p>
                      <p>Alamat: {orderAddress(order) || "-"}</p>
                      {orderMaps(order) && (
                        <a href={orderMaps(order)} target="_blank" rel="noreferrer" className="font-bold text-rose-600">
                          Buka titik Google Maps
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="grid content-start gap-4">
                    <div className="rounded-lg border border-slate-200 p-4">
                      <h3 className="font-bold">Ringkasan Pembayaran</h3>
                      <div className="mt-3 grid gap-2 text-sm">
                        <div className="flex justify-between"><span>Total Produk</span><strong>{formatCurrency(totalProduk)}</strong></div>
                        <div className="flex justify-between"><span>Ongkir</span><strong>{formatCurrency(ongkir)}</strong></div>
                        <div className="flex justify-between border-t border-slate-200 pt-2 text-base">
                          <span>Grand Total</span><strong>{formatCurrency(grandTotal)}</strong>
                        </div>
                      </div>
                    </div>

                    {proof && (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-bold text-emerald-950">Bukti Pembayaran</h3>
                            <p className="mt-1 text-sm leading-6 text-emerald-800">
                              Bukti pembayaran sudah tersimpan. Klik gambar untuk melihat ukuran penuh.
                            </p>
                          </div>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-700">Tersimpan</span>
                        </div>
                        <a href={proof} target="_blank" rel="noreferrer" className="mt-3 block w-32 overflow-hidden rounded-md border border-emerald-100 bg-white sm:w-40">
                          <img src={proof} alt="Bukti pembayaran" className="h-32 w-full object-contain sm:h-40" />
                        </a>
                      </div>
                    )}

                    {status === "menunggu_ongkir" && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                        Admin sedang menentukan ongkir. Upload bukti pembayaran akan aktif setelah ongkir disimpan.
                      </div>
                    )}

                    {status === "menunggu_pembayaran" && (
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
                        <label className="mt-3 grid gap-2 text-sm font-bold text-slate-950">
                          {proof ? "Ganti Bukti Pembayaran" : "Upload Bukti Pembayaran"}
                          <input
                            type="file"
                            accept="image/*"
                            disabled={uploadingId === order.id}
                            onChange={async (event) => {
                              await uploadPaymentProof(order, event.target.files?.[0]);
                              event.currentTarget.value = "";
                            }}
                            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-rose-100 file:px-3 file:py-2 file:font-bold file:text-rose-700"
                          />
                        </label>
                      </div>
                    )}

                    {status === "ditolak" && (
                      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800">
                        <strong>Pembayaran ditolak.</strong>
                        <p>{firstText(order.payment_rejected_reason, order.alasan_penolakan) || "Admin belum memberi alasan."}</p>
                      </div>
                    )}

                    {status === "pesanan_dikirim" && (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
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
