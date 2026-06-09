"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Product = {
  id: string;
  nama_produk: string;
  kategori: string | null;
  deskripsi: string | null;
  harga: number;
  harga_diskon: number | null;
  stok: number;
  total_dibeli: number;
  aktif: boolean;
  image_urls: string[];
  created_at: string;
  updated_at: string | null;
};

type Category = {
  id: string;
  nama: string;
};

type SortMode = "normal" | "harga_desc" | "stok_desc" | "terjual_desc";
type StatusFilter = "semua" | "aktif" | "nonaktif";

const PRODUCT_BUCKET = "product-images";

function getDiscountedPrice(price: number, discountPercent: number | null) {
  if (!discountPercent) return price;
  return price - price * (discountPercent / 100);
}

function formatShortDate(date: string | null) {
  if (!date) return "-";

  return new Date(date).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getSortLabel(activeSort: SortMode, headerSort: SortMode) {
  return activeSort === headerSort ? "v" : "-";
}

export default function AdminProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [searchName, setSearchName] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("normal");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("semua");
  const [form, setForm] = useState({
    namaProduk: "",
    kategori: "",
    deskripsi: "",
    harga: "",
    hargaDiskon: "",
    stok: "",
    aktif: true,
  });

  useEffect(() => {
    async function checkAccessAndLoad() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "admin") {
        router.push("/admin");
        return;
      }

      await loadProducts();
      await loadCategories();
      setLoading(false);
    }

    checkAccessAndLoad();
  }, [router]);

  async function loadProducts() {
    const { data, error } = await supabase
      .from("products")
      .select("id,nama_produk,kategori,deskripsi,harga,harga_diskon,stok,total_dibeli,aktif,image_urls,created_at,updated_at")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setProducts(data as Product[]);
      return;
    }

    if (error?.message.toLowerCase().includes("total_dibeli")) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("products")
        .select("id,nama_produk,kategori,deskripsi,harga,harga_diskon,stok,aktif,image_urls,created_at,updated_at")
        .order("created_at", { ascending: false });

      if (!fallbackError && fallbackData) {
        setProducts(fallbackData.map((product) => ({ ...product, total_dibeli: 0 })) as Product[]);
        setSuccess(false);
        setMessage("Kolom total_dibeli belum ada di Supabase. Jalankan SQL yang saya berikan agar data terjual tersimpan.");
      }
    }
  }

  async function loadCategories() {
    const { data, error } = await supabase
      .from("product_categories")
      .select("id,nama")
      .order("nama", { ascending: true });

    if (!error && data) {
      setCategories(data as Category[]);
    }
  }

  function updateField(name: keyof typeof form, value: string | boolean) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  const visibleProducts = useMemo(() => {
    const filteredProducts = products.filter((product) => {
      const matchesName = product.nama_produk.toLowerCase().includes(searchName.toLowerCase().trim());
      const matchesStatus =
        statusFilter === "semua" ||
        (statusFilter === "aktif" && product.aktif) ||
        (statusFilter === "nonaktif" && !product.aktif);

      return matchesName && matchesStatus;
    });

    if (sortMode === "harga_desc") {
      return [...filteredProducts].sort((first, second) => {
        const secondPrice = getDiscountedPrice(Number(second.harga), second.harga_diskon);
        const firstPrice = getDiscountedPrice(Number(first.harga), first.harga_diskon);
        return secondPrice - firstPrice;
      });
    }

    if (sortMode === "stok_desc") {
      return [...filteredProducts].sort((first, second) => second.stok - first.stok);
    }

    if (sortMode === "terjual_desc") {
      return [...filteredProducts].sort((first, second) => (second.total_dibeli || 0) - (first.total_dibeli || 0));
    }

    return filteredProducts;
  }, [products, searchName, sortMode, statusFilter]);

  function handleFiles(selectedFiles: FileList | null) {
    const remainingSlots = Math.max(5 - existingImageUrls.length, 0);
    const nextFiles = Array.from(selectedFiles ?? []).slice(0, remainingSlots);
    setFiles(nextFiles);
  }

  function resetForm() {
    setForm({
      namaProduk: "",
      kategori: "",
      deskripsi: "",
      harga: "",
      hargaDiskon: "",
      stok: "",
      aktif: true,
    });
    setFiles([]);
    setExistingImageUrls([]);
    setEditingProductId(null);
  }

  function startEdit(product: Product) {
    setEditingProductId(product.id);
    setExistingImageUrls(product.image_urls ?? []);
    setFiles([]);
    setMessage("");
    setSuccess(false);
    setForm({
      namaProduk: product.nama_produk,
      kategori: product.kategori ?? "",
      deskripsi: product.deskripsi ?? "",
      harga: String(product.harga),
      hargaDiskon: product.harga_diskon ? String(product.harga_diskon) : "",
      stok: String(product.stok),
      aktif: product.aktif,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function removeExistingImage(imageUrl: string) {
    setExistingImageUrls((current) => current.filter((url) => url !== imageUrl));
  }

  async function addCategory() {
    const cleanName = newCategory.trim();
    if (!cleanName) return;

    setMessage("");
    setSuccess(false);

    const { error } = await supabase.from("product_categories").insert({ nama: cleanName });

    if (error) {
      setMessage(error.code === "23505" ? "Kategori ini sudah ada." : error.message);
      return;
    }

    setNewCategory("");
    setSuccess(true);
    setMessage("Kategori berhasil ditambahkan.");
    await loadCategories();
  }

  async function deleteCategory(category: Category) {
    const agree = window.confirm(`Hapus kategori "${category.nama}"? Produk lama tetap menyimpan nama kategori tersebut.`);
    if (!agree) return;

    const { error } = await supabase.from("product_categories").delete().eq("id", category.id);

    if (error) {
      setSuccess(false);
      setMessage(error.message);
      return;
    }

    if (form.kategori === category.nama) {
      updateField("kategori", "");
    }

    setSuccess(true);
    setMessage("Kategori berhasil dihapus.");
    await loadCategories();
  }

  async function uploadProductImages() {
    const imageUrls: string[] = [];

    for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "-");
      const path = `${Date.now()}-${crypto.randomUUID()}-${safeName}`;

      const { error } = await supabase.storage.from(PRODUCT_BUCKET).upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
      });

      if (error) {
        throw new Error(error.message);
      }

      const { data } = supabase.storage.from(PRODUCT_BUCKET).getPublicUrl(path);
      imageUrls.push(data.publicUrl);
    }

    return imageUrls;
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setSuccess(false);

    try {
      const wasEditing = Boolean(editingProductId);

      if (existingImageUrls.length + files.length > 5) {
        throw new Error("Foto produk maksimal 5 file.");
      }

      if (form.hargaDiskon && Number(form.hargaDiskon) > 100) {
        throw new Error("Diskon persen tidak boleh lebih dari 100.");
      }

      const uploadedImageUrls = await uploadProductImages();
      const imageUrls = [...existingImageUrls, ...uploadedImageUrls];
      const payload = {
        nama_produk: form.namaProduk,
        kategori: form.kategori,
        deskripsi: form.deskripsi,
        harga: Number(form.harga),
        harga_diskon: form.hargaDiskon ? Number(form.hargaDiskon) : null,
        stok: Number(form.stok),
        aktif: form.aktif,
        image_urls: imageUrls,
      };

      const { error } = editingProductId
        ? await supabase.from("products").update(payload).eq("id", editingProductId)
        : await supabase.from("products").insert(payload);

      if (error) {
        throw new Error(error.message);
      }

      resetForm();
      setSuccess(true);
      setMessage(wasEditing ? "Produk berhasil diperbarui." : "Produk berhasil ditambahkan.");
      await loadProducts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menyimpan produk.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(productId: string) {
    const agree = window.confirm("Hapus produk ini?");
    if (!agree) return;

    const { error } = await supabase.from("products").delete().eq("id", productId);
    if (error) {
      setSuccess(false);
      setMessage(error.message);
      return;
    }

    setSuccess(true);
    setMessage("Produk berhasil dihapus.");
    await loadProducts();
  }

  async function updateProductStatus(product: Product, active: boolean) {
    const { error } = await supabase
      .from("products")
      .update({ aktif: active })
      .eq("id", product.id);

    if (error) {
      setSuccess(false);
      setMessage(error.message);
      return;
    }

    await loadProducts();
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-950">
        <p className="text-sm font-medium text-slate-600">Memuat produk...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-rose-500">Admin Panel</p>
            <h1 className="mt-1 text-2xl font-bold">Kelola Produk</h1>
          </div>
          <div className="flex gap-2">
            <Link href="/admin" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium">
              Dashboard
            </Link>
            <Link href="/" className="rounded-md bg-slate-950 px-4 py-2 text-sm font-bold text-white">
              Lihat Website
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-8 lg:grid-cols-[420px_1fr]">
        <form onSubmit={saveProduct} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold">{editingProductId ? "Edit Produk" : "Tambah Produk"}</h2>
            {editingProductId && (
              <button type="button" onClick={resetForm} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-bold">
                Batal Edit
              </button>
            )}
          </div>

          <div className="mt-5 grid gap-4">
            <label className="grid gap-2 text-sm font-medium">
              Nama Produk
              <input value={form.namaProduk} onChange={(event) => updateField("namaProduk", event.target.value)} required className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-rose-400" />
            </label>

            <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <label className="grid gap-2 text-sm font-medium">
                Kategori
                <div className="flex gap-2">
                  <select
                    value={form.kategori}
                    onChange={(event) => updateField("kategori", event.target.value)}
                    className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-rose-400"
                  >
                    <option value="">Pilih kategori</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.nama}>
                        {category.nama}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const selectedCategory = categories.find((category) => category.nama === form.kategori);
                      if (selectedCategory) {
                        deleteCategory(selectedCategory);
                      }
                    }}
                    disabled={!form.kategori}
                    className="rounded-md border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Hapus
                  </button>
                </div>
              </label>

              <div className="grid gap-2">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Kelola Kategori</p>
                <div className="flex gap-2">
                  <input
                    value={newCategory}
                    onChange={(event) => setNewCategory(event.target.value)}
                    placeholder="Contoh: Baju Wanita"
                    className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-rose-400"
                  />
                  <button type="button" onClick={addCategory} className="rounded-md bg-slate-950 px-3 py-2 text-xs font-bold text-white">
                    Tambah
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium">
                Harga Normal
                <input type="number" min="0" value={form.harga} onChange={(event) => updateField("harga", event.target.value)} required className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-rose-400" />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Diskon Persen
                <input type="number" min="0" max="100" value={form.hargaDiskon} onChange={(event) => updateField("hargaDiskon", event.target.value)} placeholder="Contoh: 10" className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-rose-400" />
              </label>
            </div>

            <label className="grid gap-2 text-sm font-medium">
              Stok
              <input type="number" min="0" value={form.stok} onChange={(event) => updateField("stok", event.target.value)} required className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-rose-400" />
            </label>

            <label className="grid gap-2 text-sm font-medium">
              Deskripsi Singkat
              <textarea value={form.deskripsi} onChange={(event) => updateField("deskripsi", event.target.value)} rows={4} className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-rose-400" />
            </label>

            <label className="grid gap-2 text-sm font-medium">
              {editingProductId ? "Tambah Foto Baru Maksimal Total 5" : "Foto Produk Maksimal 5"}
              <input type="file" accept="image/*" multiple onChange={(event) => handleFiles(event.target.files)} className="rounded-md border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-rose-100 file:px-3 file:py-1.5 file:text-rose-700" />
            </label>

            {existingImageUrls.length > 0 && (
              <div className="grid gap-2">
                <p className="text-sm font-medium">Foto Saat Ini</p>
                <div className="grid grid-cols-5 gap-2">
                  {existingImageUrls.map((imageUrl) => (
                    <div key={imageUrl} className="relative aspect-square overflow-hidden rounded-md bg-slate-100">
                      <img src={imageUrl} alt="Foto produk" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeExistingImage(imageUrl)}
                        className="absolute right-1 top-1 rounded bg-white/90 px-1.5 py-0.5 text-[11px] font-bold text-rose-700 shadow-sm"
                      >
                        Hapus
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {files.length > 0 && (
              <div className="grid grid-cols-5 gap-2">
                {files.map((file) => (
                  <div key={`${file.name}-${file.size}`} className="flex aspect-square items-center justify-center rounded-md bg-rose-50 px-2 text-center text-[11px] text-rose-700">
                    {file.name}
                  </div>
                ))}
              </div>
            )}

            <label className="flex items-center gap-3 text-sm font-medium">
              <input type="checkbox" checked={form.aktif} onChange={(event) => updateField("aktif", event.target.checked)} className="h-4 w-4 accent-rose-600" />
              Produk aktif dan tampil di customer
            </label>
          </div>

          {message && (
            <p className={`mt-4 rounded-md px-3 py-2 text-sm ${success ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
              {message}
            </p>
          )}

          <button type="submit" disabled={saving} className="mt-5 w-full rounded-md bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
            {saving ? "Menyimpan..." : editingProductId ? "Simpan Perubahan" : "Tambah Produk"}
          </button>
        </form>

        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-xl font-bold">Daftar Produk</h2>
            <p className="mt-1 text-sm text-slate-500">{visibleProducts.length} dari {products.length} produk ditampilkan</p>

            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_180px]">
              <input
                value={searchName}
                onChange={(event) => setSearchName(event.target.value)}
                placeholder="Cari nama produk..."
                className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-rose-400"
              />

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-rose-400"
              >
                <option value="semua">Semua status</option>
                <option value="aktif">Aktif</option>
                <option value="nonaktif">Nonaktif</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">No</th>
                  <th className="px-5 py-3">Produk</th>
                  <th className="px-5 py-3">Kategori</th>
                  <th className="px-5 py-3">
                    <button type="button" onClick={() => setSortMode((current) => (current === "harga_desc" ? "normal" : "harga_desc"))} className="font-bold">
                      Harga {getSortLabel(sortMode, "harga_desc")}
                    </button>
                  </th>
                  <th className="px-5 py-3">
                    <button type="button" onClick={() => setSortMode((current) => (current === "stok_desc" ? "normal" : "stok_desc"))} className="font-bold">
                      Stok {getSortLabel(sortMode, "stok_desc")}
                    </button>
                  </th>
                  <th className="px-5 py-3">
                    <button type="button" onClick={() => setSortMode((current) => (current === "terjual_desc" ? "normal" : "terjual_desc"))} className="font-bold">
                      Terjual {getSortLabel(sortMode, "terjual_desc")}
                    </button>
                  </th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleProducts.map((product, index) => (
                  <tr key={product.id}>
                    <td className="px-5 py-4 font-bold text-slate-500">{index + 1}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {product.image_urls?.[0] ? (
                          <img src={product.image_urls[0]} alt={product.nama_produk} className="h-14 w-14 rounded-md object-cover" />
                        ) : (
                          <div className="flex h-14 w-14 items-center justify-center rounded-md bg-slate-100 text-xs text-slate-500">No foto</div>
                        )}
                        <div>
                          <p className="font-bold">{product.nama_produk}</p>
                          <p className="line-clamp-1 text-xs text-slate-500">{product.deskripsi || "-"}</p>
                          <p className="mt-1 grid gap-0.5 text-[11px] leading-4 text-slate-400">
                            <span>Dibuat: {formatShortDate(product.created_at)}</span>
                            <span>Diubah: {formatShortDate(product.updated_at)}</span>
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">{product.kategori || "-"}</td>
                    <td className="px-5 py-4">
                      <p className="font-bold"><span className="text-[0.5em] align-super">Rp</span> {getDiscountedPrice(Number(product.harga), product.harga_diskon).toLocaleString("id-ID")}</p>
                      {product.harga_diskon && (
                        <p className="text-xs text-slate-400">
                          <span className="text-[0.5em] align-middle">Rp</span> <span className="line-through decoration-slate-400 decoration-1">{Number(product.harga).toLocaleString("id-ID")}</span>
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4">{product.stok}</td>
                    <td className="px-5 py-4 font-bold text-slate-700">{product.total_dibeli || 0}</td>
                    <td className="px-5 py-4">
                      <select
                        value={product.aktif ? "aktif" : "nonaktif"}
                        onChange={(event) => updateProductStatus(product, event.target.value === "aktif")}
                        className={`rounded-md border px-3 py-2 text-xs font-bold outline-none ${product.aktif ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-500"}`}
                      >
                        <option value="aktif">Aktif</option>
                        <option value="nonaktif">Nonaktif</option>
                      </select>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => startEdit(product)} className="rounded-md bg-slate-950 px-3 py-2 text-xs font-bold text-white">
                          Edit
                        </button>
                        <button type="button" onClick={() => deleteProduct(product.id)} className="rounded-md bg-rose-600 px-3 py-2 text-xs font-bold text-white">
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {visibleProducts.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-slate-500">
                      Tidak ada produk yang cocok dengan filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
