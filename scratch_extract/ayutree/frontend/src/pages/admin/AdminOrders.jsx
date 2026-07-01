import { useEffect, useState } from "react";
import api, { formatInr, safeImg } from "../../lib/api";
import { toast } from "sonner";

const STATUSES = ["placed", "shipped", "delivered", "cancelled", "awaiting_payment"];

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [open, setOpen] = useState(null);

  const load = () => api.get("/admin/orders").then((r) => setOrders(r.data));
  useEffect(() => { load(); }, []);

  const updateStatus = async (id, status) => {
    await api.patch(`/admin/orders/${id}`, { status });
    toast.success("Updated");
    load();
  };

  return (
    <div data-testid="admin-orders" className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.25em]" style={{ color: "#C2A878" }}>Operations</div>
        <h1 className="mt-2 font-serif-display text-4xl text-[#12221C]">Orders</h1>
      </div>
      <div className="bg-white border border-[#E8E1D5] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-[0.2em] text-[#5C6B64] bg-[#F3EFE6]">
            <tr>
              <th className="text-left p-3">Order</th>
              <th className="text-left p-3">Customer</th>
              <th className="text-left p-3">Date</th>
              <th className="text-right p-3">Total</th>
              <th className="text-left p-3">Payment</th>
              <th className="text-left p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.order_id} data-testid={`admin-order-${o.order_id}`} className="border-t border-[#E8E1D5] cursor-pointer hover:bg-[#F9F6F0]" onClick={() => setOpen(o)}>
                <td className="p-3 font-medium text-[#12221C]">#{o.order_id}</td>
                <td className="p-3 text-[#5C6B64]">{o.user_email}</td>
                <td className="p-3 text-[#5C6B64]">{new Date(o.created_at).toLocaleString()}</td>
                <td className="p-3 text-right text-[#1A3B32]">{formatInr(o.total)}</td>
                <td className="p-3"><span className="text-[11px] uppercase tracking-[0.18em] px-2 py-1" style={{ background: o.payment_status === "paid" ? "#E6F0EA" : "#F8EFEC", color: o.payment_status === "paid" ? "#2D5A46" : "#9E473D" }}>{o.payment_method}/{o.payment_status}</span></td>
                <td className="p-3">
                  <select data-testid={`order-status-${o.order_id}`} value={o.status} onClick={(e) => e.stopPropagation()} onChange={(e) => updateStatus(o.order_id, e.target.value)} className="bg-transparent border border-[#E8E1D5] px-2 py-1 text-xs">
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && <div className="text-sm text-[#5C6B64] p-6">No orders yet.</div>}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(null)} />
          <div className="relative w-full max-w-xl h-full bg-white overflow-y-auto p-6 md:p-8">
            <h2 className="font-serif-display text-3xl text-[#12221C]">Order #{open.order_id}</h2>
            <div className="mt-2 text-sm text-[#5C6B64]">{new Date(open.created_at).toLocaleString()}</div>
            <div className="mt-6">
              <div className="text-xs uppercase tracking-[0.2em] text-[#C2A878]">Customer</div>
              <div className="mt-1 text-[#12221C]">{open.address?.full_name} • {open.user_email}</div>
              <div className="text-sm text-[#5C6B64]">{open.address?.phone}</div>
              <div className="text-sm text-[#5C6B64] mt-1">{open.address?.line1}, {open.address?.line2}, {open.address?.city}, {open.address?.state} {open.address?.pincode}</div>
            </div>
            <div className="mt-6">
              <div className="text-xs uppercase tracking-[0.2em] text-[#C2A878]">Items</div>
              <div className="mt-3 space-y-3">
                {open.items.map((it, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <img src={safeImg(it.image)} alt="" className="w-12 h-14 object-cover bg-[#F3EFE6]" />
                    <div className="flex-1">
                      <div className="font-medium text-[#12221C]">{it.name}</div>
                      <div className="text-xs text-[#5C6B64]">Qty {it.qty} × {formatInr(it.price)}</div>
                    </div>
                    <div className="text-[#1A3B32]">{formatInr(it.total)}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-6 border-t border-[#E8E1D5] pt-4 text-sm space-y-2">
              <div className="flex justify-between text-[#5C6B64]"><span>Subtotal</span><span>{formatInr(open.subtotal)}</span></div>
              <div className="flex justify-between text-[#5C6B64]"><span>Shipping</span><span>{formatInr(open.shipping)}</span></div>
              <div className="flex justify-between text-[#5C6B64]"><span>Tax</span><span>{formatInr(open.tax)}</span></div>
              <div className="flex justify-between text-base font-medium text-[#12221C]"><span>Total</span><span>{formatInr(open.total)}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
