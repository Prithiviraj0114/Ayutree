import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Trash, Minus, Plus, Tag } from "@phosphor-icons/react";
import { useCart } from "../contexts/CartContext";
import api, { formatInr, safeImg } from "../lib/api";
import { toast } from "sonner";

export default function Cart() {
  const { items, subtotal, update, remove, loading } = useCart();
  const navigate = useNavigate();
  const [code, setCode] = useState(() => sessionStorage.getItem("ayu_coupon_code") || "");
  const [applied, setApplied] = useState(() => {
    const raw = sessionStorage.getItem("ayu_coupon_applied");
    return raw ? JSON.parse(raw) : null;
  });
  const [applying, setApplying] = useState(false);

  const apply = async () => {
    if (!code.trim()) { toast.error("Enter a code"); return; }
    setApplying(true);
    try {
      const { data } = await api.post("/coupons/validate", { code, subtotal });
      setApplied(data);
      sessionStorage.setItem("ayu_coupon_code", data.code);
      sessionStorage.setItem("ayu_coupon_applied", JSON.stringify(data));
      toast.success(`${data.code} applied — ₹${Math.round(data.discount)} off`);
    } catch (e) {
      setApplied(null);
      sessionStorage.removeItem("ayu_coupon_applied");
      toast.error(e.response?.data?.detail || "Invalid coupon");
    } finally { setApplying(false); }
  };

  const removeCoupon = () => {
    setApplied(null);
    setCode("");
    sessionStorage.removeItem("ayu_coupon_code");
    sessionStorage.removeItem("ayu_coupon_applied");
  };

  const shipping = subtotal >= 499 || subtotal === 0 ? 0 : 49;
  const tax = +(subtotal * 0.05).toFixed(2);
  const discount = applied ? Math.min(applied.discount, subtotal) : 0;
  const total = Math.max(0, +(subtotal + shipping + tax - discount).toFixed(2));

  return (
    <div data-testid="cart-page" className="px-6 md:px-12 lg:px-20 py-12 md:py-16 min-h-[70vh]">
      <div className="text-xs uppercase tracking-[0.25em] text-[#5C6B64] mb-3">
        <Link to="/" className="hover:text-[#1A3B32]">Home</Link> / <span style={{ color: "#C2A878" }}>Bag</span>
      </div>
      <h1 className="font-serif-display text-4xl md:text-5xl font-light text-[#12221C] mb-10">Your Bag</h1>

      {loading ? (
        <div className="text-sm text-[#5C6B64]">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-center py-24">
          <p className="font-serif-display text-2xl text-[#12221C]">Your bag is empty</p>
          <p className="text-sm text-[#5C6B64] mt-2">Begin a ritual from our apothecary.</p>
          <Link to="/shop/all" className="inline-block mt-6 px-8 py-4 text-xs uppercase tracking-[0.2em]" style={{ background: "#1A3B32", color: "#F9F6F0" }}>Shop Now</Link>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 divide-y divide-[#E8E1D5] border-y border-[#E8E1D5]">
            {items.map((it) => (
              <div key={it.product_id} data-testid={`cart-row-${it.product_id}`} className="flex flex-col sm:flex-row sm:items-center gap-4 py-6">
                <div className="flex gap-4 flex-1">
                  <div className="w-20 h-20 md:w-24 md:h-24 shrink-0 overflow-hidden bg-[#F3EFE6]">
                    <img src={safeImg(it.product?.image)} alt={it.product?.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <Link to={`/product/${it.product_id}`} className="font-serif-display text-lg md:text-xl text-[#12221C]">{it.product?.name}</Link>
                    <div className="text-[10px] md:text-xs uppercase tracking-[0.18em] mt-1" style={{ color: "#C2A878" }}>{it.product?.category?.replace("-", " ")}</div>
                    <div className="text-sm text-[#1A3B32] mt-1 md:mt-2">{formatInr(it.product?.price)}</div>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex items-center border border-[#E8E1D5]">
                        <button data-testid={`dec-${it.product_id}`} onClick={() => update(it.product_id, it.qty - 1)} className="w-8 h-8 flex items-center justify-center"><Minus size={12} /></button>
                        <span className="w-8 text-center text-sm">{it.qty}</span>
                        <button data-testid={`inc-${it.product_id}`} onClick={() => update(it.product_id, it.qty + 1)} className="w-8 h-8 flex items-center justify-center"><Plus size={12} /></button>
                      </div>
                      <button data-testid={`remove-${it.product_id}`} onClick={() => remove(it.product_id)} className="text-xs uppercase tracking-[0.18em] text-[#9E473D] flex items-center gap-1"><Trash size={14} /> Remove</button>
                    </div>
                  </div>
                </div>
                <div className="text-left sm:text-right text-sm font-medium text-[#1A3B32] pl-24 sm:pl-0">{formatInr((it.product?.price || 0) * it.qty)}</div>
              </div>
            ))}
          </div>

          <aside className="lg:sticky lg:top-24 h-fit border border-[#E8E1D5] p-6 bg-white">
            <h2 className="font-serif-display text-2xl text-[#12221C]">Order Summary</h2>

            {/* Coupon */}
            <div className="mt-5">
              <div className="text-xs uppercase tracking-[0.18em] text-[#1A3B32] flex items-center gap-2"><Tag size={14} /> Coupon</div>
              {applied ? (
                <div className="mt-2 flex items-center justify-between p-3 border border-[#1A3B32] bg-[#F3EFE6]" data-testid="applied-coupon">
                  <div>
                    <div className="font-mono text-sm text-[#1A3B32]">{applied.code}</div>
                    <div className="text-[11px] text-[#5C6B64]">{applied.description}</div>
                  </div>
                  <button data-testid="remove-coupon" onClick={removeCoupon} className="text-xs text-[#9E473D] uppercase tracking-[0.18em]">Remove</button>
                </div>
              ) : (
                <div className="mt-2 flex gap-2">
                  <input
                    data-testid="coupon-input"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="WELCOME10"
                    className="flex-1 bg-transparent border border-[#E8E1D5] px-3 py-2 text-sm font-mono outline-none focus:border-[#1A3B32]"
                  />
                  <button data-testid="apply-coupon" onClick={apply} disabled={applying} className="px-4 py-2 text-xs uppercase tracking-[0.18em] border border-[#1A3B32] text-[#1A3B32] hover:bg-[#1A3B32] hover:text-white transition-colors disabled:opacity-60">
                    {applying ? "…" : "Apply"}
                  </button>
                </div>
              )}
            </div>

            <div className="mt-5 space-y-3 text-sm text-[#5C6B64]">
              <div className="flex justify-between"><span>Subtotal</span><span data-testid="summary-subtotal">{formatInr(subtotal)}</span></div>
              <div className="flex justify-between"><span>Shipping</span><span>{shipping === 0 ? "Free" : formatInr(shipping)}</span></div>
              <div className="flex justify-between"><span>Tax (5%)</span><span>{formatInr(tax)}</span></div>
              {discount > 0 && (
                <div className="flex justify-between text-[#2D5A46]"><span>Coupon discount</span><span>−{formatInr(discount)}</span></div>
              )}
              <div className="border-t border-[#E8E1D5] my-3" />
              <div className="flex justify-between text-base font-medium text-[#12221C]"><span>Total</span><span data-testid="summary-total">{formatInr(total)}</span></div>
            </div>
            <button data-testid="checkout-btn" onClick={() => navigate("/checkout")} className="mt-6 w-full py-4 text-xs uppercase tracking-[0.2em]" style={{ background: "#1A3B32", color: "#F9F6F0" }}>
              Proceed to Checkout
            </button>
            <p className="mt-3 text-[11px] text-[#5C6B64] text-center">Free shipping on orders above ₹499</p>
          </aside>
        </div>
      )}
    </div>
  );
}
