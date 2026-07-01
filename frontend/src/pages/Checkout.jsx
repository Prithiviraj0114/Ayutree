import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api, { formatInr, safeImg } from "../lib/api";
import { useCart } from "../contexts/CartContext";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";

export default function Checkout() {
  const { items, subtotal, refresh } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [placing, setPlacing] = useState(false);
  const [method, setMethod] = useState("cod");
  const [coupon] = useState(() => {
    const raw = sessionStorage.getItem("ayu_coupon_applied");
    return raw ? JSON.parse(raw) : null;
  });
  const [form, setForm] = useState({
    full_name: user?.name || "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
  });

  const shipping = subtotal >= 499 ? 0 : 49;
  const tax = +(subtotal * 0.05).toFixed(2);
  const discount = coupon ? Math.min(coupon.discount, subtotal) : 0;
  const total = Math.max(0, +(subtotal + shipping + tax - discount).toFixed(2));

  const onChange = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const loadCashfree = () =>
    new Promise((resolve) => {
      if (window.Cashfree) return resolve(true);
      const s = document.createElement("script");
      s.src = "https://sdk.cashfree.com/pg/v3/cashfree.js";
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });

  const loadRazorpay = () =>
    new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });

  const placeOrder = async () => {
    if (!form.full_name || !form.phone || !form.line1 || !form.city || !form.pincode || !form.state) {
      toast.error("Please complete the shipping address");
      return;
    }
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(form.phone)) {
      toast.error("Phone number must be exactly 10 digits");
      return;
    }
    const pincodeRegex = /^[0-9]{6}$/;
    if (!pincodeRegex.test(form.pincode)) {
      toast.error("Pincode must be exactly 6 digits");
      return;
    }
    setPlacing(true);
    try {
      const { data } = await api.post("/checkout", {
        address: form,
        payment_method: method,
        coupon_code: coupon?.code || null,
      });
      const clearCoupon = () => {
        sessionStorage.removeItem("ayu_coupon_code");
        sessionStorage.removeItem("ayu_coupon_applied");
      };
      
      if (method === "cod") {
        await refresh();
        clearCoupon();
        toast.success("Order placed!");
        navigate(`/profile?order=${data.order_id}`);
        return;
      }

      if (method === "razorpay") {
        const loaded = await loadRazorpay();
        if (!loaded || !window.Razorpay) {
          toast.error("Failed to load Razorpay library. Please check your connection.");
          return;
        }

        const options = {
          key: process.env.REACT_APP_RAZORPAY_KEY_ID || data.razorpay_key_id || "rzp_test_T3CrMrhjfvzi9d",
          amount: Math.round(data.total * 100),
          currency: "INR",
          name: "Ayutree",
          description: `Order #${data.order_id}`,
          order_id: data.razorpay_order_id,
          handler: async function (response) {
            try {
              setPlacing(true);
              await api.post("/payments/razorpay/verify", {
                order_id: data.order_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              await refresh();
              clearCoupon();
              toast.success("Payment successful! Order placed.");
              navigate(`/profile?order=${data.order_id}`);
            } catch (err) {
              toast.error(err.response?.data?.detail || "Payment verification failed");
            } finally {
              setPlacing(false);
            }
          },
          prefill: {
            name: form.full_name,
            email: user?.email || "",
            contact: form.phone,
          },
          theme: {
            color: "#1A3B32",
          },
          modal: {
            ondismiss: function () {
              toast.error("Payment cancelled");
              setPlacing(false);
            }
          }
        };

        const rzp = new window.Razorpay(options);
        rzp.on("payment.failed", function (response) {
          toast.error(`Payment failed: ${response.error.description}`);
          setPlacing(false);
        });
        rzp.open();
        return;
      }

      // Cashfree flow
      await loadCashfree();
      if (!window.Cashfree || data.is_test_mode) {
        // simulate verify to complete flow
        await api.post("/payments/verify", {
          order_id: data.order_id,
          cf_order_id: data.order_id,
          cf_payment_id: "sim_pay_" + Date.now(),
        });
        await refresh();
        clearCoupon();
        toast.success("Payment simulated (test mode). Order placed.");
        navigate(`/profile?order=${data.order_id}`);
        return;
      }
      const cashfree = window.Cashfree({
        mode: "sandbox" // change to "production" when live
      });
      cashfree.checkout({
        paymentSessionId: data.payment_session_id,
        returnUrl: `${window.location.origin}/profile?order=${data.order_id}`
      }).then(async (result) => {
        if(result.error){
            toast.error("Payment failed or cancelled");
            return;
        }
        if(result.redirect){
            // Redirected to returnUrl
            return;
        }
      });
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to place order");
    } finally { setPlacing(false); }
  };

  if (items.length === 0) {
    return (
      <div className="px-6 py-24 text-center">
        <p className="font-serif-display text-2xl">Your bag is empty</p>
        <Link to="/shop/all" className="inline-block mt-6 px-8 py-4 text-xs uppercase tracking-[0.2em]" style={{ background: "#1A3B32", color: "#F9F6F0" }}>Shop Now</Link>
      </div>
    );
  }

  const fld = (label, key, type = "text", extra = {}) => (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.2em] text-[#C2A878]">{label}</span>
      <input
        data-testid={`field-${key}`}
        type={type}
        value={form[key]}
        onChange={(e) => onChange(key, e.target.value)}
        className="mt-1 block w-full bg-transparent border-b border-[#E8E1D5] focus:border-[#1A3B32] outline-none py-2 text-sm text-[#12221C]"
        {...extra}
      />
    </label>
  );

  return (
    <div data-testid="checkout-page" className="px-6 md:px-12 lg:px-20 py-12 md:py-16 grid lg:grid-cols-3 gap-10">
      <div className="lg:col-span-2">
        <h1 className="font-serif-display text-4xl md:text-5xl font-light text-[#12221C]">Checkout</h1>
        <section className="mt-10">
          <h2 className="text-xs uppercase tracking-[0.25em] text-[#1A3B32] mb-5">Shipping Address</h2>
          <div className="grid md:grid-cols-2 gap-x-6 gap-y-5">
            {fld("Full name", "full_name")}
            {fld("Phone", "phone")}
            <div className="md:col-span-2">{fld("Address line 1", "line1")}</div>
            <div className="md:col-span-2">{fld("Address line 2 (optional)", "line2")}</div>
            {fld("City", "city")}
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#C2A878]">State</span>
              <select
                data-testid="field-state"
                value={form.state}
                onChange={(e) => onChange("state", e.target.value)}
                className="mt-1 block w-full bg-transparent border-b border-[#E8E1D5] focus:border-[#1A3B32] outline-none py-2 text-sm text-[#12221C] cursor-pointer"
              >
                <option value="" disabled className="bg-white text-gray-500">Select State</option>
                {[
                  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", 
                  "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", 
                  "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", 
                  "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", 
                  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", 
                  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"
                ].map((st) => (
                  <option key={st} value={st} className="bg-white text-black">{st}</option>
                ))}
              </select>
            </label>
            {fld("Pincode", "pincode")}
            {fld("Country", "country")}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-xs uppercase tracking-[0.25em] text-[#1A3B32] mb-5">Payment</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { id: "cod", label: "Cash on Delivery", desc: "Pay when you receive" },
              { id: "cashfree", label: "Cashfree Payments (UPI, Card, NetBanking)", desc: "Instant secure checkout" },
              { id: "razorpay", label: "Razorpay (Cards, UPI, NetBanking)", desc: "Fast & secure payment" },
            ].map((opt) => (
              <button
                key={opt.id}
                data-testid={`payment-${opt.id}`}
                type="button"
                onClick={() => setMethod(opt.id)}
                className={`text-left p-5 border ${method === opt.id ? "border-[#1A3B32]" : "border-[#E8E1D5]"} bg-white`}
              >
                <div className="text-sm font-medium text-[#12221C]">{opt.label}</div>
                <div className="text-xs text-[#5C6B64] mt-1">{opt.desc}</div>
              </button>
            ))}
          </div>
        </section>
      </div>

      <aside className="lg:sticky lg:top-24 h-fit border border-[#E8E1D5] p-6 bg-white">
        <h2 className="font-serif-display text-2xl text-[#12221C]">Summary</h2>
        <div className="mt-4 space-y-3 max-h-64 overflow-auto no-scrollbar pr-2">
          {items.map((it) => (
            <div key={it.product_id} className="flex gap-3 text-sm">
              <img src={safeImg(it.product?.image)} className="w-14 h-16 object-cover bg-[#F3EFE6]" alt="" />
              <div className="flex-1">
                <div className="font-medium text-[#12221C]">{it.product?.name}</div>
                <div className="text-xs text-[#5C6B64]">Qty {it.qty}</div>
              </div>
              <div className="text-[#1A3B32]">{formatInr((it.product?.price || 0) * it.qty)}</div>
            </div>
          ))}
        </div>
        <div className="border-t border-[#E8E1D5] mt-4 pt-4 space-y-2 text-sm text-[#5C6B64]">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatInr(subtotal)}</span></div>
          <div className="flex justify-between"><span>Shipping</span><span>{shipping === 0 ? "Free" : formatInr(shipping)}</span></div>
          <div className="flex justify-between"><span>Tax</span><span>{formatInr(tax)}</span></div>
          {discount > 0 && (
            <div className="flex justify-between text-[#2D5A46]">
              <span>Coupon ({coupon.code})</span>
              <span>−{formatInr(discount)}</span>
            </div>
          )}
          <div className="border-t border-[#E8E1D5] my-2" />
          <div className="flex justify-between text-base font-medium text-[#12221C]"><span>Total</span><span>{formatInr(total)}</span></div>
        </div>
        <button data-testid="place-order-btn" disabled={placing} onClick={placeOrder} className="mt-6 w-full py-4 text-xs uppercase tracking-[0.2em] disabled:opacity-60" style={{ background: "#1A3B32", color: "#F9F6F0" }}>
          {placing ? "Processing…" : `Place Order — ${formatInr(total)}`}
        </button>
      </aside>
    </div>
  );
}
