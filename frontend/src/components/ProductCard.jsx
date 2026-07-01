import { Link } from "react-router-dom";
import { Heart } from "@phosphor-icons/react";
import { formatInr, safeImg } from "../lib/api";
import { useCart } from "../contexts/CartContext";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";

export default function ProductCard({ product, onWishlist }) {
  const { add } = useCart();
  const { user } = useAuth();

  const onAdd = async (e) => {
    e.preventDefault();
    if (!user) { toast.error("Please sign in to add items"); return; }
    try { await add(product.product_id, 1); toast.success(`${product.name} added`); } catch { toast.error("Failed"); }
  };

  const onWish = (e) => {
    e.preventDefault();
    onWishlist?.(product);
  };

  const discount = product.mrp && product.mrp > product.price ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0;

  return (
    <Link
      to={`/product/${product.product_id}`}
      data-testid={`product-card-${product.product_id}`}
      className="group block bg-white border border-[#E8E1D5] hover:shadow-[0_8px_30px_rgba(26,59,50,0.08)] transition-all duration-300"
    >
      <div className="relative aspect-[4/5] overflow-hidden" style={{ background: "#F3EFE6" }}>
        <img
          src={safeImg(product.image)}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        {discount > 0 && (
          <span className="absolute top-3 left-3 text-[10px] uppercase tracking-[0.18em] px-2 py-1" style={{ background: "#1A3B32", color: "#F9F6F0" }}>
            −{discount}%
          </span>
        )}
        <button
          data-testid={`wishlist-${product.product_id}`}
          onClick={onWish}
          className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center bg-white/80 backdrop-blur-sm hover:bg-white"
          aria-label="wishlist"
        >
          <Heart size={18} weight="light" />
        </button>
        <button
          data-testid={`add-to-cart-${product.product_id}`}
          onClick={onAdd}
          className="absolute inset-x-3 bottom-3 py-3 text-xs uppercase tracking-[0.2em] font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background: "#1A3B32", color: "#F9F6F0" }}
        >
          Add to Bag
        </button>
      </div>
      <div className="p-4">
        <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: "#C2A878" }}>
          {product.category?.replace("-", " ")}
        </div>
        <h3 className="font-serif-display text-lg leading-snug mt-1 text-[#12221C]">{product.name}</h3>
        <p className="text-xs text-[#5C6B64] mt-1 line-clamp-2">{product.short_description}</p>
        <div className="flex items-baseline gap-2 mt-3">
          <span className="text-base font-medium text-[#1A3B32]">{formatInr(product.price)}</span>
          {product.mrp && product.mrp > product.price && (
            <span className="text-xs line-through text-[#9AA6A0]">{formatInr(product.mrp)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
