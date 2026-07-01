import { useEffect, useState } from "react";
import { Trash, Pencil } from "@phosphor-icons/react";
import api from "../../lib/api";
import { toast } from "sonner";

const empty = { code: "", type: "percent", value: 10, min_order: 499, max_discount: "", expires_at: "", active: true, usage_limit: "", description: "" };

export default function AdminCoupons() {
  const [list, setList] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const load = () => api.get("/admin/coupons").then((r) => setList(r.data));
  useEffect(() => { load(); }, []);

  const startCreate = () => { setEditing("new"); setForm(empty); };
  const startEdit = (c) => {
    setEditing(c.code);
    setForm({
      code: c.code,
      type: c.type,
      value: c.value,
      min_order: c.min_order || 0,
      max_discount: c.max_discount || "",
      expires_at: c.expires_at || "",
      active: c.active,
      usage_limit: c.usage_limit || "",
      description: c.description || "",
    });
  };

  const save = async () => {
    const payload = {
      ...form,
      code: form.code.trim().toUpperCase(),
      value: +form.value,
      min_order: +form.min_order || 0,
      max_discount: form.max_discount ? +form.max_discount : null,
      usage_limit: form.usage_limit ? +form.usage_limit : null,
      expires_at: form.expires_at || null,
    };
    try {
      if (editing === "new") await api.post("/admin/coupons", payload);
      else await api.patch(`/admin/coupons/${editing}`, payload);
      toast.success("Saved");
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Save failed");
    }
  };

  const del = async (code) => {
    if (!confirm(`Delete coupon ${code}?`)) return;
    await api.delete(`/admin/coupons/${code}`);
    toast.success("Deleted");
    load();
  };

  return (
    <div data-testid="admin-coupons" className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.25em]" style={{ color: "#C2A878" }}>Promotions</div>
          <h1 className="mt-2 font-serif-display text-4xl text-[#12221C]">Coupons</h1>
        </div>
        <button data-testid="admin-add-coupon" onClick={startCreate} className="px-4 py-2 text-xs uppercase tracking-[0.18em]" style={{ background: "#1A3B32", color: "#F9F6F0" }}>+ New Coupon</button>
      </div>

      <div className="bg-white border border-[#E8E1D5] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-[0.2em] text-[#5C6B64] bg-[#F3EFE6]">
            <tr>
              <th className="text-left p-3">Code</th>
              <th className="text-left p-3">Type</th>
              <th className="text-right p-3">Value</th>
              <th className="text-right p-3">Min Order</th>
              <th className="text-left p-3">Description</th>
              <th className="text-right p-3">Used</th>
              <th className="text-left p-3">Active</th>
              <th className="text-right p-3"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.code} className="border-t border-[#E8E1D5]">
                <td className="p-3 font-mono font-medium text-[#1A3B32]">{c.code}</td>
                <td className="p-3 text-[#5C6B64]">{c.type}</td>
                <td className="p-3 text-right">{c.type === "percent" ? `${c.value}%` : `₹${c.value}`}</td>
                <td className="p-3 text-right">₹{c.min_order || 0}</td>
                <td className="p-3 text-[#5C6B64]">{c.description}</td>
                <td className="p-3 text-right">{c.used_count || 0}{c.usage_limit ? ` / ${c.usage_limit}` : ""}</td>
                <td className="p-3"><span className="text-[11px] uppercase tracking-[0.18em] px-2 py-1" style={{ background: c.active ? "#E6F0EA" : "#F8EFEC", color: c.active ? "#2D5A46" : "#9E473D" }}>{c.active ? "active" : "off"}</span></td>
                <td className="p-3 text-right">
                  <button data-testid={`edit-coupon-${c.code}`} onClick={() => startEdit(c)} className="px-2 py-1 text-xs text-[#1A3B32] inline-flex items-center gap-1"><Pencil size={12} /> Edit</button>
                  <button data-testid={`delete-coupon-${c.code}`} onClick={() => del(c.code)} className="px-2 py-1 text-xs text-[#9E473D] inline-flex items-center gap-1"><Trash size={12} /> Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <div className="p-6 text-sm text-[#5C6B64]">No coupons yet.</div>}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setEditing(null)} />
          <div className="relative w-full max-w-xl h-full bg-white overflow-y-auto p-6 md:p-8">
            <h2 className="font-serif-display text-3xl text-[#12221C]">{editing === "new" ? "New Coupon" : `Edit ${editing}`}</h2>
            <div className="mt-6 space-y-4 text-sm">
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#C2A878]">Code</span>
                <input data-testid="coupon-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} disabled={editing !== "new"} className="mt-1 w-full bg-transparent border-b border-[#E8E1D5] focus:border-[#1A3B32] outline-none py-2 font-mono disabled:opacity-60" />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[#C2A878]">Type</span>
                  <select data-testid="coupon-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="mt-1 w-full bg-transparent border-b border-[#E8E1D5] py-2">
                    <option value="percent">Percent</option>
                    <option value="flat">Flat ₹</option>
                  </select>
                </label>
                <label>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[#C2A878]">Value</span>
                  <input data-testid="coupon-value" type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="mt-1 w-full bg-transparent border-b border-[#E8E1D5] py-2" />
                </label>
                <label>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[#C2A878]">Min order ₹</span>
                  <input type="number" value={form.min_order} onChange={(e) => setForm({ ...form, min_order: e.target.value })} className="mt-1 w-full bg-transparent border-b border-[#E8E1D5] py-2" />
                </label>
                <label>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[#C2A878]">Max discount ₹ (optional)</span>
                  <input type="number" value={form.max_discount} onChange={(e) => setForm({ ...form, max_discount: e.target.value })} className="mt-1 w-full bg-transparent border-b border-[#E8E1D5] py-2" />
                </label>
                <label>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[#C2A878]">Usage limit (optional)</span>
                  <input type="number" value={form.usage_limit} onChange={(e) => setForm({ ...form, usage_limit: e.target.value })} className="mt-1 w-full bg-transparent border-b border-[#E8E1D5] py-2" />
                </label>
                <label>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[#C2A878]">Expires at (ISO)</span>
                  <input type="datetime-local" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} className="mt-1 w-full bg-transparent border-b border-[#E8E1D5] py-2" />
                </label>
              </div>
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#C2A878]">Description</span>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 w-full bg-transparent border-b border-[#E8E1D5] py-2" />
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                <span className="text-xs uppercase tracking-[0.18em]">Active</span>
              </label>
            </div>
            <div className="mt-8 flex gap-3">
              <button data-testid="save-coupon" onClick={save} className="px-6 py-3 text-xs uppercase tracking-[0.2em]" style={{ background: "#1A3B32", color: "#F9F6F0" }}>Save</button>
              <button onClick={() => setEditing(null)} className="px-6 py-3 text-xs uppercase tracking-[0.2em] border border-[#E8E1D5]">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
