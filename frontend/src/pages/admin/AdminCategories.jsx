import { useEffect, useState } from "react";
import { Trash, Pencil, UploadSimple, Folder } from "@phosphor-icons/react";
import api, { safeImg, BACKEND_URL } from "../../lib/api";
import { toast } from "sonner";

const empty = { slug: "", name: "", image: "" };

export default function AdminCategories() {
  const [list, setList] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [products, setProducts] = useState(null);
  const [productCounts, setProductCounts] = useState({});
  const [allProducts, setAllProducts] = useState([]);

  const load = async () => {
    const { data } = await api.get("/categories");
    setList(data);
    const counts = {};
    await Promise.all(data.map(async (c) => {
      const r = await api.get(`/products?category=${c.slug}&limit=500`);
      counts[c.slug] = r.data.length;
    }));
    setProductCounts(counts);
  };
  useEffect(() => { load(); }, []);

  const startCreate = () => { setEditing("new"); setForm(empty); setProducts(null); setAllProducts([]); };
  const startEdit = async (c) => {
    setEditing(c.slug);
    setForm({ slug: c.slug, name: c.name, image: c.image || "" });
    const { data } = await api.get(`/admin/categories/${c.slug}/products`);
    setProducts(data);
    const pData = await api.get("/products?limit=1000");
    setAllProducts(pData.data);
  };

  const removeProduct = async (p) => {
    try {
      await api.patch(`/admin/products/${p.product_id}`, { category: "uncategorized" });
      setProducts(products.filter(x => x.product_id !== p.product_id));
      toast.success("Removed from category");
      load(); // refresh counts
    } catch (e) { toast.error("Failed to remove product"); }
  };

  const addProduct = async (e) => {
    const pid = e.target.value;
    if (!pid) return;
    try {
      await api.patch(`/admin/products/${pid}`, { category: editing });
      const { data } = await api.get(`/admin/categories/${editing}/products`);
      setProducts(data);
      toast.success("Added to category");
      load(); // refresh counts
    } catch (e) { toast.error("Failed to add product"); }
  };

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post("/admin/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setForm((f) => ({ ...f, image: `${BACKEND_URL}${data.url}` }));
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Upload failed");
    } finally { e.target.value = ""; }
  };

  const save = async () => {
    try {
      const slug = form.slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, "-");
      if (editing === "new") {
        await api.post("/admin/categories", { ...form, slug });
      } else {
        await api.patch(`/admin/categories/${editing}`, { name: form.name, image: form.image });
      }
      toast.success("Saved");
      setEditing(null);
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Save failed"); }
  };

  const del = async (slug) => {
    if (!confirm(`Delete category "${slug}"?`)) return;
    try {
      await api.delete(`/admin/categories/${slug}`);
      toast.success("Deleted");
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Delete failed"); }
  };

  return (
    <div data-testid="admin-categories" className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.25em]" style={{ color: "#C2A878" }}>Catalogue</div>
          <h1 className="mt-2 font-serif-display text-4xl text-[#12221C]">Categories</h1>
        </div>
        <button data-testid="admin-add-category" onClick={startCreate} className="px-4 py-2 text-xs uppercase tracking-[0.18em]" style={{ background: "#1A3B32", color: "#F9F6F0" }}>+ New Category</button>
      </div>

      <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {list.map((c) => (
          <div key={c.slug} data-testid={`category-card-${c.slug}`} className="bg-white border border-[#E8E1D5] overflow-hidden group">
            <div className="aspect-[4/3] overflow-hidden bg-[#F3EFE6]">
              <img src={safeImg(c.image)} alt={c.name} className="w-full h-full object-cover" />
            </div>
            <div className="p-4">
              <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: "#C2A878" }}>{c.slug}</div>
              <div className="font-serif-display text-xl text-[#12221C] mt-1">{c.name}</div>
              <div className="text-xs text-[#5C6B64] mt-1 flex items-center gap-1"><Folder size={12} /> {productCounts[c.slug] ?? 0} products</div>
              <div className="mt-3 flex gap-2">
                <button data-testid={`edit-category-${c.slug}`} onClick={() => startEdit(c)} className="text-xs text-[#1A3B32] inline-flex items-center gap-1"><Pencil size={12} /> Edit</button>
                <button data-testid={`delete-category-${c.slug}`} onClick={() => del(c.slug)} className="text-xs text-[#9E473D] inline-flex items-center gap-1"><Trash size={12} /> Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setEditing(null)} />
          <div className="relative w-full max-w-2xl h-full bg-white overflow-y-auto p-6 md:p-8">
            <h2 className="font-serif-display text-3xl text-[#12221C]">{editing === "new" ? "New Category" : `Edit ${editing}`}</h2>
            <div className="mt-6 space-y-4 text-sm">
              <div className="flex items-start gap-4">
                <div className="w-24 h-28 border border-[#E8E1D5] overflow-hidden bg-[#F3EFE6]">
                  <img src={safeImg(form.image)} alt="" className="w-full h-full object-cover" />
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[#C2A878]">Category cover</span>
                  <label className="mt-2 flex items-center gap-2 px-3 py-2 border border-[#1A3B32] text-[#1A3B32] cursor-pointer hover:bg-[#1A3B32] hover:text-white transition-colors w-fit text-xs uppercase tracking-[0.18em]">
                    <UploadSimple size={14} /> Upload Photo
                    <input type="file" accept="image/*" onChange={onUpload} className="hidden" />
                  </label>
                </div>
              </div>
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#C2A878]">Slug (URL friendly)</span>
                <input data-testid="cat-slug" disabled={editing !== "new"} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="mt-1 w-full bg-transparent border-b border-[#E8E1D5] py-2 disabled:opacity-60" />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#C2A878]">Display name</span>
                <input data-testid="cat-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full bg-transparent border-b border-[#E8E1D5] py-2" />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#C2A878]">Image URL</span>
                <input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} className="mt-1 w-full bg-transparent border-b border-[#E8E1D5] py-2" />
              </label>
            </div>

            {products && (
              <div className="mt-8">
                <div className="text-xs uppercase tracking-[0.18em] text-[#5C6B64] flex justify-between items-center">
                  <span>Products in this category ({products.length})</span>
                  <select onChange={addProduct} className="bg-transparent border border-[#E8E1D5] px-2 py-1 text-xs outline-none max-w-[200px]" value="">
                    <option value="">+ Add Product</option>
                    {allProducts.filter(x => x.category !== editing).map(x => (
                      <option key={x.product_id} value={x.product_id}>{x.name}</option>
                    ))}
                  </select>
                </div>
                {products.length > 0 ? (
                  <div className="mt-3 grid grid-cols-2 gap-2 max-h-64 overflow-auto no-scrollbar">
                    {products.map((p) => (
                      <div key={p.product_id} className="flex items-center justify-between gap-2 border border-[#E8E1D5] p-2 text-xs group transition-colors hover:border-[#1A3B32]">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <img src={safeImg(p.image)} alt="" className="w-8 h-10 object-cover bg-[#F3EFE6] shrink-0" />
                          <span className="line-clamp-2 text-[#12221C]">{p.name}</span>
                        </div>
                        <button onClick={() => removeProduct(p)} className="text-[#9E473D] opacity-0 group-hover:opacity-100 px-2 shrink-0" title="Remove from category">
                          <Trash size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 text-xs text-[#5C6B64]">No products in this category yet.</div>
                )}
              </div>
            )}

            <div className="mt-8 flex gap-3">
              <button data-testid="save-category" onClick={save} className="px-6 py-3 text-xs uppercase tracking-[0.2em]" style={{ background: "#1A3B32", color: "#F9F6F0" }}>Save</button>
              <button onClick={() => setEditing(null)} className="px-6 py-3 text-xs uppercase tracking-[0.2em] border border-[#E8E1D5]">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
