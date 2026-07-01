import { useEffect, useState } from "react";
import { Plus, Pencil, Trash, UploadSimple } from "@phosphor-icons/react";
import api, { formatInr, safeImg, BACKEND_URL } from "../../lib/api";
import { toast } from "sonner";

const empty = {
  name: "", category: "face-care", price: 200, mrp: 250, stock: 100,
  short_description: "", description: "", ingredients: "", image: "",
  benefits: [], featured: false,
};

const CATS = ["face-care", "hair-care", "body-care", "soaps", "lip-care", "eye-care", "men", "kids", "foot-care", "pain-relief"];

export default function AdminProducts() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [q, setQ] = useState("");

  const load = () => api.get("/products?limit=500").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const filtered = items.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));

  const startCreate = () => { setEditing("new"); setForm(empty); };
  const startEdit = (p) => {
    setEditing(p.product_id);
    setForm({
      name: p.name, category: p.category, price: p.price, mrp: p.mrp || p.price, stock: p.stock,
      short_description: p.short_description || "", description: p.description || "",
      ingredients: p.ingredients || "", image: p.image || "",
      benefits: p.benefits || [], featured: !!p.featured,
    });
  };

  const save = async () => {
    try {
      const payload = { ...form, price: +form.price, mrp: +form.mrp, stock: +form.stock };
      if (editing === "new") await api.post("/admin/products", payload);
      else await api.patch(`/admin/products/${editing}`, payload);
      toast.success("Saved");
      setEditing(null);
      load();
    } catch (e) {
      toast.error("Failed to save");
    }
  };

  const del = async (id) => {
    if (!confirm("Delete this product?")) return;
    await api.delete(`/admin/products/${id}`);
    toast.success("Deleted");
    load();
  };

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post("/admin/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      const fullUrl = `${BACKEND_URL}${data.url}`;
      setForm((f) => ({ ...f, image: fullUrl }));
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Upload failed");
    } finally {
      e.target.value = "";
    }
  };

  return (
    <div data-testid="admin-products" className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.25em]" style={{ color: "#C2A878" }}>Catalogue</div>
          <h1 className="mt-2 font-serif-display text-4xl text-[#12221C]">Products</h1>
        </div>
        <div className="flex gap-3">
          <input data-testid="admin-product-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" className="px-3 py-2 text-sm bg-white border border-[#E8E1D5] focus:border-[#1A3B32] outline-none" />
          <button data-testid="admin-add-product" onClick={startCreate} className="px-4 py-2 text-xs uppercase tracking-[0.18em] flex items-center gap-2" style={{ background: "#1A3B32", color: "#F9F6F0" }}>
            <Plus size={14} /> Add Product
          </button>
        </div>
      </div>

      <div className="bg-white border border-[#E8E1D5] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-[0.2em] text-[#5C6B64] bg-[#F3EFE6]">
            <tr>
              <th className="text-left p-3">Product</th>
              <th className="text-left p-3">Category</th>
              <th className="text-right p-3">Price</th>
              <th className="text-right p-3">Stock</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.product_id} className="border-t border-[#E8E1D5]">
                <td className="p-3"><div className="flex items-center gap-3"><img src={safeImg(p.image)} alt="" className="w-10 h-12 object-cover bg-[#F3EFE6]" /><span className="font-medium text-[#12221C]">{p.name}</span></div></td>
                <td className="p-3 text-[#5C6B64]">{p.category}</td>
                <td className="p-3 text-right text-[#1A3B32]">{formatInr(p.price)}</td>
                <td className="p-3 text-right">{p.stock}</td>
                <td className="p-3 text-right">
                  <button data-testid={`edit-${p.product_id}`} onClick={() => startEdit(p)} className="px-2 py-1 text-xs text-[#1A3B32] inline-flex items-center gap-1"><Pencil size={12} /> Edit</button>
                  <button data-testid={`delete-${p.product_id}`} onClick={() => del(p.product_id)} className="px-2 py-1 text-xs text-[#9E473D] inline-flex items-center gap-1"><Trash size={12} /> Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit drawer */}
      {editing && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setEditing(null)} />
          <div className="relative w-full max-w-xl h-full bg-white overflow-y-auto p-6 md:p-8">
            <h2 className="font-serif-display text-3xl text-[#12221C]">{editing === "new" ? "New Product" : "Edit Product"}</h2>
            <div className="mt-6 space-y-4 text-sm">
              {/* Image preview + upload */}
              <div className="flex items-start gap-4">
                <div className="w-24 h-28 border border-[#E8E1D5] overflow-hidden flex items-center justify-center bg-[#F3EFE6]">
                  <img src={safeImg(form.image)} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[#C2A878]">Product image</span>
                  <label data-testid="upload-image-btn" className="mt-2 flex items-center gap-2 px-3 py-2 border border-[#1A3B32] text-[#1A3B32] cursor-pointer hover:bg-[#1A3B32] hover:text-white transition-colors w-fit text-xs uppercase tracking-[0.18em]">
                    <UploadSimple size={14} /> Upload Photo
                    <input data-testid="upload-image-input" type="file" accept="image/*" onChange={onUpload} className="hidden" />
                  </label>
                  <p className="text-[10px] text-[#9AA6A0] mt-1">JPG / PNG / WebP up to 5 MB</p>
                </div>
              </div>
              {[
                ["Name", "name"],
                ["Image URL", "image"],
                ["Short description", "short_description"],
                ["Description", "description"],
                ["Ingredients", "ingredients"],
              ].map(([label, key]) => (
                <label key={key} className="block">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[#C2A878]">{label}</span>
                  <input data-testid={`field-${key}`} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="mt-1 w-full bg-transparent border-b border-[#E8E1D5] focus:border-[#1A3B32] outline-none py-2" />
                </label>
              ))}
              <div className="grid grid-cols-2 gap-4">
                <label>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[#C2A878]">Category</span>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1 w-full bg-transparent border-b border-[#E8E1D5] focus:border-[#1A3B32] outline-none py-2">
                    {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[#C2A878]">Stock</span>
                  <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="mt-1 w-full bg-transparent border-b border-[#E8E1D5] focus:border-[#1A3B32] outline-none py-2" />
                </label>
                <label>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[#C2A878]">Price (₹)</span>
                  <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="mt-1 w-full bg-transparent border-b border-[#E8E1D5] focus:border-[#1A3B32] outline-none py-2" />
                </label>
                <label>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[#C2A878]">MRP (₹)</span>
                  <input type="number" value={form.mrp} onChange={(e) => setForm({ ...form, mrp: e.target.value })} className="mt-1 w-full bg-transparent border-b border-[#E8E1D5] focus:border-[#1A3B32] outline-none py-2" />
                </label>
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={!!form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />
                <span className="text-xs uppercase tracking-[0.18em]">Featured</span>
              </label>
            </div>
            <div className="mt-8 flex gap-3">
              <button data-testid="save-product" onClick={save} className="px-6 py-3 text-xs uppercase tracking-[0.2em]" style={{ background: "#1A3B32", color: "#F9F6F0" }}>Save</button>
              <button onClick={() => setEditing(null)} className="px-6 py-3 text-xs uppercase tracking-[0.2em] border border-[#E8E1D5]">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
