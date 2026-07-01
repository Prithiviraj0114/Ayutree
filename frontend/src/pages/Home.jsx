import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Leaf, ShieldCheck, Sparkle, Truck, Quotes, Star } from "@phosphor-icons/react";
import api from "../lib/api";
import ProductCard from "../components/ProductCard";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.7, ease: "easeOut" },
};

const TESTIMONIALS = [
  {
    name: "Priya Raghavan",
    city: "Chennai, TN",
    rating: 5,
    text: "I'd given up on hair-fall solutions until I tried the Ancient Method Hair Oil. Six weeks in and my baby hairs are back. The fragrance is gentle, the texture isn't sticky, and I genuinely look forward to my Sunday oiling now.",
    product: "Ancient Method Hair Oil",
  },
  {
    name: "Aarav Mehta",
    city: "Mumbai, MH",
    rating: 5,
    text: "Switched my entire skincare from a popular brand to Ayutree's Charcoal Face Wash and Kachur cream. Three months later — clear, even, calm skin. My wife noticed before I did.",
    product: "Charcoal Face Wash",
  },
  {
    name: "Saanvi Iyer",
    city: "Bengaluru, KA",
    rating: 5,
    text: "The Goat Milk & Kumkumadi 15mL is liquid gold. I use 3 drops every night and wake up with that 'just back from a holiday' glow. Worth every rupee.",
    product: "Goat Milk & Kumkumadi 15mL",
  },
  {
    name: "Rohan Krishnan",
    city: "Hyderabad, TS",
    rating: 4,
    text: "Bought the Baby Massage Oil for my 4-month-old. Cold-pressed, smells like home, and my mum approved — which is the highest possible bar.",
    product: "Baby Massage Oil",
  },
  {
    name: "Neha Subramanian",
    city: "Coimbatore, TN",
    rating: 5,
    text: "I'm a salon owner. I now stock Ayutree's hibiscus shampoo and frizz-free serum for my clients. The repeat-purchase rate is the highest of any brand on my shelf.",
    product: "Hibiscus Shampoo",
  },
  {
    name: "Karthik Ramesh",
    city: "Pune, MH",
    rating: 5,
    text: "Beard oil that actually conditions instead of just smelling nice. Two weeks of use, no more itchy beard, and the cedarwood note is fantastic.",
    product: "Beard Oil",
  },
];

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
      <section className="relative min-h-[88vh] flex items-center overflow-hidden">
        <img
          src="https://ayutree.com/cdn/shop/collections/pexels-sora-shimazaki-5938261_1.jpg?v=1699334573&width=750"
          alt="ayurveda hero"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, rgba(18,34,28,0.78) 0%, rgba(18,34,28,0.45) 55%, rgba(18,34,28,0.1) 100%)" }} />
        <div className="relative px-6 md:px-12 lg:px-20 pt-16 pb-48 md:py-24 max-w-4xl">
          <motion.div {...fadeUp}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 border" style={{ borderColor: "#C2A878", color: "#C2A878" }}>
              <Sparkle size={14} weight="fill" />
              <span data-testid="hero-eyebrow" className="text-[11px] uppercase tracking-[0.3em]">Certified Organic · Handcrafted</span>
            </div>
            <h1 className="mt-8 font-serif-display text-4xl sm:text-5xl lg:text-7xl font-light leading-[1.02] text-white" data-testid="hero-title">
              Heal with Ancient<br />
              <span className="italic" style={{ color: "#C2A878" }}>Ayurvedic Wisdom</span>
            </h1>
            <p className="mt-7 text-base md:text-lg text-[#E8E1D5] max-w-2xl font-light leading-relaxed" data-testid="hero-subtitle">
              Discover our range of 100% natural, handcrafted Ayurvedic products. Formulated from age-old recipes using the finest herbs and botanicals.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link to="/shop/all" data-testid="hero-shop-now" className="px-9 py-4 text-xs uppercase tracking-[0.2em] font-medium inline-flex items-center gap-2 transition-transform hover:translate-y-[-2px]" style={{ background: "#C2A878", color: "#12221C" }}>
                Shop Now <ArrowRight size={14} />
              </Link>
              <Link to="/shop/face-care" data-testid="hero-explore-skin" className="px-9 py-4 text-xs uppercase tracking-[0.2em] font-medium border border-[#E8E1D5] text-[#F9F6F0] hover:bg-white/10 transition-colors inline-flex items-center gap-2">
                Explore Skin Care <ArrowRight size={14} />
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Stats strip pinned to bottom of hero */}
        <div className="absolute left-0 right-0 bottom-0 px-6 md:px-12 lg:px-20 pb-8">
          <motion.div {...fadeUp} className="grid grid-cols-3 max-w-3xl border border-[#C2A878]/30 backdrop-blur-md" style={{ background: "rgba(18,34,28,0.55)" }}>
            {[
              { num: "50+", label: "Products" },
              { num: "1,240", label: "Happy Customers" },
              { num: "100%", label: "Natural" },
            ].map((s, i) => (
              <div key={i} data-testid={`hero-stat-${i}`} className={`p-5 md:p-7 ${i < 2 ? "border-r border-[#C2A878]/30" : ""}`}>
                <div className="font-serif-display text-3xl md:text-5xl text-[#C2A878] leading-none">{s.num}</div>
                <div className="mt-2 text-[10px] md:text-[11px] uppercase tracking-[0.25em] text-[#E8E1D5]">{s.label}</div>
              </div>
            ))}
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

      {/* CATEGORIES — premium grid */}
      <section className="px-6 md:px-12 lg:px-20 py-20 md:py-28">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
          <div>
            <div className="text-xs uppercase tracking-[0.25em]" style={{ color: "#C2A878" }}>Catalogue</div>
            <h2 className="mt-2 font-serif-display text-3xl md:text-5xl font-light text-[#12221C]">Find your daily ritual</h2>
          </div>
          <Link to="/shop/all" className="text-xs uppercase tracking-[0.2em] font-medium text-[#1A3B32] underline underline-offset-4">Browse all products →</Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
          {categories.map((c) => (
            <Link
              key={c.slug}
              to={`/shop/${c.slug}`}
              data-testid={`category-${c.slug}`}
              className="relative overflow-hidden group aspect-[4/5] border border-[#E8E1D5] bg-[#F3EFE6]"
            >
              <img src={c.image} alt={c.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#12221C]/80 via-[#12221C]/25 to-transparent opacity-90 group-hover:opacity-100 transition-opacity" />
              <div className="absolute inset-x-4 bottom-4 text-white">
                <div className="text-[9px] uppercase tracking-[0.25em]" style={{ color: "#C2A878" }}>Collection</div>
                <h3 className="font-serif-display text-lg md:text-xl mt-0.5">{c.name}</h3>
              </div>
            </Link>
          ))}
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

      {/* WHAT CUSTOMERS SAY */}
      <section className="px-6 md:px-12 lg:px-20 py-20 md:py-28 border-y border-[#E8E1D5]" style={{ background: "#F3EFE6" }}>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <div>
            <div className="text-xs uppercase tracking-[0.25em]" style={{ color: "#C2A878" }}>Loved By Many</div>
            <h2 className="mt-2 font-serif-display text-3xl md:text-5xl font-light text-[#12221C]" data-testid="testimonials-title">What customers say</h2>
            <p className="mt-3 text-sm text-[#5C6B64] max-w-xl">From skincare sceptics to ritual devotees — read why thousands trust Ayutree with their daily care.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex">{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={18} weight="fill" color="#C2A878" />)}</div>
            <div className="text-xs uppercase tracking-[0.18em] text-[#1A3B32]">4.9 / 5 · 1,240+ Reviews</div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={i}
              data-testid={`testimonial-${i}`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="bg-white border border-[#E8E1D5] p-6 relative"
            >
              <Quotes size={32} weight="fill" className="absolute top-5 right-5 opacity-15" color="#1A3B32" />
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, k) => (
                  <Star key={k} size={14} weight="fill" color={k < t.rating ? "#C2A878" : "#E8E1D5"} />
                ))}
              </div>
              <p className="mt-4 text-sm leading-relaxed text-[#12221C] font-light">"{t.text}"</p>
              <div className="mt-5 pt-4 border-t border-[#E8E1D5] flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm text-[#1A3B32]">{t.name}</div>
                  <div className="text-[11px] text-[#5C6B64]">{t.city}</div>
                </div>
                <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "#C2A878" }}>{t.product}</div>
              </div>
            </motion.div>
          ))}
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
            <img src="https://ayutree.com/cdn/shop/collections/Captureeeeeee.png?v=1700481434&width=750" alt="story" className="w-full h-full object-cover" />
          </div>
        </div>
      </section>
    </div>
  );
}
