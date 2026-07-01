import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Heart, Truck, ShieldCheck, Plant, Minus, Plus } from "@phosphor-icons/react";
import api, { formatInr, safeImg } from "../lib/api";
import { useCart } from "../contexts/CartContext";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import ReviewForm from "../components/ReviewForm";

export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState("ingredients");
  const { add } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const loadProduct = () => api.get(`/products/${id}`).then((r) => setProduct(r.data)).catch(() => setProduct(null));
  useEffect(() => { loadProduct(); }, [id]);

  if (!product) return <div className="px-6 py-24 text-center">Loading…</div>;

  const onAdd = async (buyNow = false) => {
    if (!user) { toast.error("Sign in to continue"); navigate("/login"); return; }
    await add(product.product_id, qty);
    toast.success(`${product.name} added`);
    if (buyNow) navigate("/cart");
  };

  return (
    <div data-testid="product-detail-page" className="px-6 md:px-12 lg:px-20 py-10 md:py-16">
      <div className="text-xs uppercase tracking-[0.25em] text-[#5C6B64] mb-6">
        <Link to="/" className="hover:text-[#1A3B32]">Home</Link> / <Link to={`/shop/${product.category}`} className="hover:text-[#1A3B32]">{product.category.replace("-", " ")}</Link> / <span style={{ color: "#C2A878" }}>{product.name}</span>
      </div>
      <div className="grid md:grid-cols-2 gap-8 md:gap-16">
        <div className="aspect-square md:aspect-[4/5] overflow-hidden" style={{ background: "#F3EFE6" }}>
          <img src={safeImg(product.image)} alt={product.name} className="w-full h-full object-cover" />
        </div>
        <div className="md:pt-6">
          <div className="text-xs uppercase tracking-[0.25em]" style={{ color: "#C2A878" }}>{product.category.replace("-", " ")}</div>
          <h1 className="mt-3 font-serif-display text-3xl md:text-5xl font-light leading-tight text-[#12221C]">{product.name}</h1>
          <p className="mt-3 text-[#5C6B64] font-light leading-relaxed">{product.short_description}</p>

          <div className="mt-6 flex items-baseline gap-3">
            <span className="text-2xl text-[#1A3B32] font-medium">{formatInr(product.price)}</span>
            {product.mrp && product.mrp > product.price && (
              <>
                <span className="text-base line-through text-[#9AA6A0]">{formatInr(product.mrp)}</span>
                <span className="text-xs uppercase tracking-[0.18em] text-[#2D5A46]">Save {formatInr(product.mrp - product.price)}</span>
              </>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {(product.benefits || []).map((b, i) => (
              <span key={i} className="text-[11px] uppercase tracking-[0.16em] px-3 py-1.5" style={{ background: "#F3EFE6", color: "#1A3B32" }}>
                {b}
              </span>
            ))}
          </div>

          <div className="mt-8 flex items-center gap-4">
            <div className="flex items-center border border-[#E8E1D5]">
              <button data-testid="qty-decrement" onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-10 h-12 flex items-center justify-center"><Minus size={14} /></button>
              <span data-testid="qty-value" className="w-10 text-center text-sm">{qty}</span>
              <button data-testid="qty-increment" onClick={() => setQty((q) => q + 1)} className="w-10 h-12 flex items-center justify-center"><Plus size={14} /></button>
            </div>
            <button data-testid="add-to-bag-btn" onClick={() => onAdd(false)} className="flex-1 py-4 text-xs uppercase tracking-[0.2em] font-medium border border-[#1A3B32] text-[#1A3B32] hover:bg-[#1A3B32] hover:text-white transition-colors">
              Add to Bag
            </button>
            <button data-testid="buy-now-btn" onClick={() => onAdd(true)} className="flex-1 py-4 text-xs uppercase tracking-[0.2em] font-medium" style={{ background: "#1A3B32", color: "#F9F6F0" }}>
              Buy Now
            </button>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-3 text-[11px] text-[#5C6B64]">
            <div className="flex items-center gap-2"><Truck size={18} weight="light" /> Free over ₹499</div>
            <div className="flex items-center gap-2"><ShieldCheck size={18} weight="light" /> 100% Authentic</div>
            <div className="flex items-center gap-2"><Plant size={18} weight="light" /> Cruelty-free</div>
          </div>

          {/* Tabs */}
          <div className="mt-10 border-t border-[#E8E1D5] pt-6">
            <div className="flex gap-6 text-xs uppercase tracking-[0.18em]">
              {["ingredients", "how-to-use", "description"].map((t) => (
                <button
                  key={t}
                  data-testid={`tab-${t}`}
                  onClick={() => setTab(t)}
                  className={`py-2 border-b-2 transition-colors ${tab === t ? "border-[#1A3B32] text-[#1A3B32]" : "border-transparent text-[#5C6B64]"}`}
                >
                  {t.replace("-", " ")}
                </button>
              ))}
            </div>
            <div className="mt-4 text-sm text-[#5C6B64] leading-relaxed font-light">
              {tab === "ingredients" && (product.ingredients || "Hand-picked ayurvedic botanicals.")}
              {tab === "how-to-use" && "Apply a small amount to clean, dry skin/hair. Use daily or as part of your weekly ritual for best results."}
              {tab === "description" && product.description}
            </div>
          </div>
        </div>
      </div>

      {(product.reviews?.length || 0) > 0 && (
        <section className="mt-16">
          <h2 className="font-serif-display text-2xl md:text-3xl text-[#12221C]">Customer Notes</h2>
          <div className="mt-6 grid md:grid-cols-2 gap-4">
            {product.reviews.map((r) => (
              <div key={r.review_id} className="border border-[#E8E1D5] p-5 bg-white">
                <div className="text-xs uppercase tracking-[0.18em] text-[#1A3B32]">{"★".repeat(r.rating)}<span className="text-[#9AA6A0]">{"★".repeat(5 - r.rating)}</span></div>
                <p className="mt-2 text-sm text-[#5C6B64]">{r.comment}</p>
                <div className="mt-3 text-[11px] uppercase tracking-[0.18em] text-[#C2A878]">{r.user_name}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-12 max-w-2xl">
        <ReviewForm productId={product.product_id} onSubmitted={loadProduct} />
      </section>
    </div>
  );
}
