import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import api, { formatInr, safeImg } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

export default function Profile() {
  const { user, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [search] = useSearchParams();
  const justPlaced = search.get("order");

  useEffect(() => { api.get("/orders").then((r) => setOrders(r.data)); }, []);

  return (
    <div data-testid="profile-page" className="px-6 md:px-12 lg:px-20 py-12 md:py-16">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
        <div>
          <div className="text-xs uppercase tracking-[0.25em]" style={{ color: "#C2A878" }}>Account</div>
          <h1 className="mt-2 font-serif-display text-4xl md:text-5xl font-light text-[#12221C]">Hello, {user?.name?.split(" ")[0]}</h1>
          <p className="text-sm text-[#5C6B64] mt-1">{user?.email}</p>
        </div>
        <div className="flex gap-3">
          <Link to="/shop/all" className="px-6 py-3 text-xs uppercase tracking-[0.2em] border border-[#1A3B32] text-[#1A3B32]">Continue Shopping</Link>
          <button data-testid="profile-logout" onClick={logout} className="px-6 py-3 text-xs uppercase tracking-[0.2em] text-[#9E473D]">Sign out</button>
        </div>
      </div>

      {justPlaced && (
        <div className="mb-8 p-5 border border-[#1A3B32] bg-[#F3EFE6]">
          <div className="text-xs uppercase tracking-[0.2em]" style={{ color: "#1A3B32" }}>Order placed</div>
          <p className="font-serif-display text-2xl text-[#12221C] mt-1">Thank you. Order #{justPlaced}</p>
          <p className="text-sm text-[#5C6B64] mt-1">We will email you tracking details shortly.</p>
        </div>
      )}

      <h2 className="text-xs uppercase tracking-[0.25em] text-[#1A3B32] mb-5">Order History</h2>
      {orders.length === 0 ? (
        <div className="text-sm text-[#5C6B64]">No orders yet.</div>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <div key={o.order_id} data-testid={`order-${o.order_id}`} className="border border-[#E8E1D5] bg-white p-5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <div className="font-medium text-[#12221C]">Order #{o.order_id}</div>
                  <div className="text-xs text-[#5C6B64]">{new Date(o.created_at).toLocaleString()}</div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[11px] uppercase tracking-[0.18em] px-3 py-1" style={{ background: "#F3EFE6", color: "#1A3B32" }}>{o.status}</span>
                  <span className="text-[11px] uppercase tracking-[0.18em] px-3 py-1" style={{ background: o.payment_status === "paid" ? "#E6F0EA" : "#F8EFEC", color: o.payment_status === "paid" ? "#2D5A46" : "#9E473D" }}>{o.payment_status}</span>
                  <span className="font-medium text-[#1A3B32]">{formatInr(o.total)}</span>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                {o.items.map((it, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <img src={safeImg(it.image)} alt="" className="w-10 h-12 object-cover bg-[#F3EFE6]" />
                    <span className="text-[#5C6B64]">{it.name} × {it.qty}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
