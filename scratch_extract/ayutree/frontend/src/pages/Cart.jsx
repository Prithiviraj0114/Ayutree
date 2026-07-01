import { Link, useNavigate } from "react-router-dom";
import { Trash, Minus, Plus } from "@phosphor-icons/react";
import { useCart } from "../contexts/CartContext";
import { formatInr, safeImg } from "../lib/api";

export default function Cart() {
  const { items, subtotal, update, remove, loading } = useCart();
  const navigate = useNavigate();
  const shipping = subtotal >= 499 || subtotal === 0 ? 0 : 49;
  const tax = +(subtotal * 0.05).toFixed(2);
  const total = +(subtotal + shipping + tax).toFixed(2);

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
              <div key={it.product_id} data-testid={`cart-row-${it.product_id}`} className="grid grid-cols-[100px_1fr_auto] md:grid-cols-[120px_1fr_auto] gap-4 py-6">
                <div className="aspect-square overflow-hidden bg-[#F3EFE6]">
                  <img src={safeImg(it.product?.image)} alt={it.product?.name} className="w-full h-full object-cover" />
                </div>
                <div>
                  <Link to={`/product/${it.product_id}`} className="font-serif-display text-xl text-[#12221C]">{it.product?.name}</Link>
                  <div className="text-xs uppercase tracking-[0.18em] mt-1" style={{ color: "#C2A878" }}>{it.product?.category?.replace("-", " ")}</div>
                  <div className="text-sm text-[#1A3B32] mt-2">{formatInr(it.product?.price)}</div>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex items-center border border-[#E8E1D5]">
                      <button data-testid={`dec-${it.product_id}`} onClick={() => update(it.product_id, it.qty - 1)} className="w-8 h-9 flex items-center justify-center"><Minus size={12} /></button>
                      <span className="w-8 text-center text-sm">{it.qty}</span>
                      <button data-testid={`inc-${it.product_id}`} onClick={() => update(it.product_id, it.qty + 1)} className="w-8 h-9 flex items-center justify-center"><Plus size={12} /></button>
                    </div>
                    <button data-testid={`remove-${it.product_id}`} onClick={() => remove(it.product_id)} className="text-xs uppercase tracking-[0.18em] text-[#9E473D] flex items-center gap-1"><Trash size={14} /> Remove</button>
                  </div>
                </div>
                <div className="text-right text-sm font-medium text-[#1A3B32]">{formatInr((it.product?.price || 0) * it.qty)}</div>
              </div>
            ))}
          </div>

          <aside className="lg:sticky lg:top-24 h-fit border border-[#E8E1D5] p-6 bg-white">
            <h2 className="font-serif-display text-2xl text-[#12221C]">Order Summary</h2>
            <div className="mt-5 space-y-3 text-sm text-[#5C6B64]">
              <div className="flex justify-between"><span>Subtotal</span><span data-testid="summary-subtotal">{formatInr(subtotal)}</span></div>
              <div className="flex justify-between"><span>Shipping</span><span>{shipping === 0 ? "Free" : formatInr(shipping)}</span></div>
              <div className="flex justify-between"><span>Tax (5%)</span><span>{formatInr(tax)}</span></div>
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
