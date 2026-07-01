import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Leaf, ShieldCheck, Sparkle, Truck } from "@phosphor-icons/react";
import api, { formatInr } from "../lib/api";
import ProductCard from "../components/ProductCard";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.7, ease: "easeOut" },
};

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    api.get("/products?featured=true&limit=8").then((r) => setFeatured(r.data));
    api.get("/categories").then((r) => setCategories(r.data));
  }, []);

  return (
    <div data-testid="home-page">
      {/* HERO */}
      <section className="relative min-h-[78vh] flex items-end overflow-hidden">
        <img
          src="https://images.pexels.com/photos/6811712/pexels-photo-6811712.jpeg"
          alt="ayurveda hero"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(120deg, rgba(18,34,28,0.65) 0%, rgba(18,34,28,0.2) 60%, transparent 100%)" }} />
        <div className="relative px-6 md:px-12 lg:px-20 pb-16 md:pb-24 max-w-3xl">
          <motion.div {...fadeUp}>
            <div className="text-xs uppercase tracking-[0.3em] mb-6" style={{ color: "#C2A878" }}>The Ayutree Apothecary</div>
            <h1 className="font-serif-display text-4xl sm:text-5xl lg:text-6xl font-light leading-[1.05] text-white">
              Empowered by Nature.<br /><em className="font-light">Enhanced by Ayurveda.</em>
            </h1>
            <p className="mt-6 text-base text-[#E8E1D5] max-w-xl font-light leading-relaxed">
              A modern apothecary of 1000+ year old recipes — hand-cooked in small batches with ingredients you can pronounce.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link to="/shop/all" data-testid="hero-cta-shop" className="px-8 py-4 text-xs uppercase tracking-[0.2em] font-medium" style={{ background: "#C2A878", color: "#12221C" }}>
                Explore Apothecary
              </Link>
              <Link to="/shop/face-care" className="px-8 py-4 text-xs uppercase tracking-[0.2em] font-medium border border-[#E8E1D5] text-[#F9F6F0] hover:bg-white/10 transition-colors">
                The Face Ritual <ArrowRight size={14} className="inline ml-1" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* PILLARS */}
      <section className="px-6 md:px-12 lg:px-20 py-12 border-b border-[#E8E1D5]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10">
          {[
            { icon: <Leaf size={28} weight="light" />, t: "Botanical-First", s: "1000+ year recipes" },
            { icon: <ShieldCheck size={28} weight="light" />, t: "Dermatologist Tested", s: "Skin-safe formulas" },
            { icon: <Sparkle size={28} weight="light" />, t: "Hand-Crafted", s: "Small-batch quality" },
            { icon: <Truck size={28} weight="light" />, t: "Free Shipping", s: "Above ₹499 in India" },
          ].map((p, i) => (
            <div key={i} className="flex items-start gap-3">
              <div style={{ color: "#C2A878" }}>{p.icon}</div>
              <div>
                <div className="font-serif-display text-lg text-[#12221C]">{p.t}</div>
                <div className="text-xs text-[#5C6B64] mt-0.5">{p.s}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CATEGORIES — asymmetric bento */}
      <section className="px-6 md:px-12 lg:px-20 py-20 md:py-28">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
          <div>
            <div className="text-xs uppercase tracking-[0.25em]" style={{ color: "#C2A878" }}>Catalogue</div>
            <h2 className="mt-2 font-serif-display text-3xl md:text-5xl font-light text-[#12221C]">Find your daily ritual</h2>
          </div>
          <Link to="/shop/all" className="text-xs uppercase tracking-[0.2em] font-medium text-[#1A3B32] underline underline-offset-4">Browse all categories →</Link>
        </div>

        <div className="grid grid-cols-12 gap-4 md:gap-6">
          {categories.slice(0, 6).map((c, i) => {
            const span = [
              "col-span-12 md:col-span-7 row-span-2 aspect-[16/11] md:aspect-[16/12]",
              "col-span-6 md:col-span-5 aspect-square md:aspect-[5/4]",
              "col-span-6 md:col-span-5 aspect-square md:aspect-[5/4]",
              "col-span-6 md:col-span-4 aspect-[4/5]",
              "col-span-6 md:col-span-4 aspect-[4/5]",
              "col-span-12 md:col-span-4 aspect-[4/5] md:aspect-[4/5]",
            ];
            return (
              <Link
                key={c.slug}
                to={`/shop/${c.slug}`}
                data-testid={`category-${c.slug}`}
                className={`relative overflow-hidden group ${span[i]}`}
              >
                <img src={c.image} alt={c.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-tr from-black/55 via-black/10 to-transparent" />
                <div className="absolute inset-0 p-6 flex flex-col justify-end text-white">
                  <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: "#C2A878" }}>Collection</div>
                  <div className="font-serif-display text-2xl md:text-3xl mt-1">{c.name}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* FEATURED */}
      <section className="px-6 md:px-12 lg:px-20 pb-20">
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="text-xs uppercase tracking-[0.25em]" style={{ color: "#C2A878" }}>Bestsellers</div>
            <h2 className="mt-2 font-serif-display text-3xl md:text-5xl font-light text-[#12221C]">Mainstay rituals</h2>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {featured.map((p) => (<ProductCard key={p.product_id} product={p} />))}
        </div>
      </section>

      {/* STORY */}
      <section className="px-6 md:px-12 lg:px-20 py-24 md:py-32" style={{ background: "#1A3B32", color: "#F9F6F0" }}>
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="text-xs uppercase tracking-[0.3em]" style={{ color: "#C2A878" }}>Our Story</div>
            <h2 className="mt-3 font-serif-display text-3xl md:text-5xl font-light">A return to slow beauty.</h2>
            <p className="mt-6 text-[#D8CFC0] leading-relaxed font-light">
              Inspired by grandmothers' kitchens and ancient ayurvedic texts, Ayutree blends saffron, kumkumadi, neem, hibiscus and other botanicals into modern rituals that work — without parabens, sulphates, or shortcuts.
            </p>
            <p className="mt-4 text-[#D8CFC0] leading-relaxed font-light">
              Every bottle is hand-poured, every recipe is rooted in evidence and tradition.
            </p>
          </div>
          <div className="aspect-[4/5] md:aspect-[5/4] overflow-hidden">
            <img src="https://images.unsplash.com/photo-1748543668676-ea8241cb3886" alt="story" className="w-full h-full object-cover" />
          </div>
        </div>
      </section>
    </div>
  );
}
