export default function Marquee() {
  const text = "Empowered by Nature  •  Enhanced by Ayurveda  •  1000+ Year Old Recipes  •  Hand-Packed in Small Batches  •  Free Shipping over ₹499  •  ";
  return (
    <div data-testid="brand-marquee" className="overflow-hidden border-y" style={{ background: "#1A3B32", borderColor: "#1A3B32" }}>
      <div className="marquee-track flex whitespace-nowrap py-2.5 will-change-transform">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className="font-serif-display italic text-base md:text-lg px-6" style={{ color: "#C2A878" }}>
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}
