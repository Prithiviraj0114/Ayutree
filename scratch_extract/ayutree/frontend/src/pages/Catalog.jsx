import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import api from "../lib/api";
import ProductCard from "../components/ProductCard";

const CATEGORY_LABELS = {
  all: "Apothecary",
  "face-care": "Face Care",
  "hair-care": "Hair Care",
  "body-care": "Body Care",
  soaps: "Soaps",
  "lip-care": "Lip Care",
  "eye-care": "Eye Care",
  men: "Men Exclusive",
  kids: "Kids",
  "foot-care": "Foot Care",
  "pain-relief": "Pain Relief",
};

export default function Catalog() {
  const { category = "all" } = useParams();
  const [search] = useSearchParams();
  const q = search.get("q") || "";
  const [items, setItems] = useState([]);
  const [sort, setSort] = useState("featured");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (category !== "all") params.set("category", category);
    if (q) params.set("q", q);
    api.get(`/products?${params.toString()}`).then((r) => { setItems(r.data); setLoading(false); });
  }, [category, q]);

  const sorted = useMemo(() => {
    const arr = [...items];
    if (sort === "price-low") arr.sort((a, b) => a.price - b.price);
    if (sort === "price-high") arr.sort((a, b) => b.price - a.price);
    if (sort === "name") arr.sort((a, b) => a.name.localeCompare(b.name));
    return arr;
  }, [items, sort]);

  const title = CATEGORY_LABELS[category] || "Apothecary";

  return (
    <div data-testid="catalog-page" className="px-6 md:px-12 lg:px-20 py-12 md:py-16">
      <div className="text-xs uppercase tracking-[0.25em] text-[#5C6B64]">
        <Link to="/" className="hover:text-[#1A3B32]">Home</Link> / <span style={{ color: "#C2A878" }}>{title}</span>
      </div>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between mt-3 gap-4">
        <h1 className="font-serif-display text-4xl md:text-5xl lg:text-6xl font-light text-[#12221C]">{title}</h1>
        <div className="flex items-center gap-3">
          {q && <span className="text-xs text-[#5C6B64]">Search: <em className="text-[#1A3B32]">"{q}"</em></span>}
          <select
            data-testid="sort-select"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="bg-transparent border border-[#E8E1D5] px-3 py-2 text-xs uppercase tracking-[0.15em] text-[#1A3B32] outline-none"
          >
            <option value="featured">Featured</option>
            <option value="price-low">Price: Low to high</option>
            <option value="price-high">Price: High to low</option>
            <option value="name">Name (A–Z)</option>
          </select>
        </div>
      </div>

      <div className="mt-10 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[4/5] bg-[#F3EFE6] animate-pulse" />
          ))
        ) : sorted.length === 0 ? (
          <div className="col-span-full text-center py-20 text-[#5C6B64]">No products found.</div>
        ) : (
          sorted.map((p) => <ProductCard key={p.product_id} product={p} />)
        )}
      </div>
    </div>
  );
}
