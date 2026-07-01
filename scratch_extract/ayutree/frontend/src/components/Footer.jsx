import { Link } from "react-router-dom";
import { InstagramLogo, FacebookLogo, YoutubeLogo } from "@phosphor-icons/react";
import Logo from "./Logo";

export default function Footer() {
  return (
    <footer className="mt-24 border-t" style={{ background: "#12221C", color: "#E8E1D5", borderColor: "#1A3B32" }}>
      <div className="px-6 md:px-12 lg:px-20 py-16 grid md:grid-cols-4 gap-12">
        <div>
          <div className="text-2xl font-serif-display tracking-tight" style={{ color: "#C2A878" }}>ayu<span className="italic">tree</span></div>
          <p className="mt-3 text-sm font-light leading-relaxed text-[#A5B3AC]">
            Empowered by Nature, Enhanced by Ayurveda. Handcrafted ayurvedic beauty from 1000+ year old recipes.
          </p>
          <div className="flex gap-4 mt-5">
            <a href="https://www.instagram.com/ayutreecosmetics/" target="_blank" rel="noreferrer" aria-label="instagram"><InstagramLogo size={22} weight="light" /></a>
            <a href="https://www.facebook.com/profile.php?id=61552031330399" target="_blank" rel="noreferrer" aria-label="facebook"><FacebookLogo size={22} weight="light" /></a>
            <a href="https://www.youtube.com/@Ayutreecosmetics" target="_blank" rel="noreferrer" aria-label="youtube"><YoutubeLogo size={22} weight="light" /></a>
          </div>
        </div>
        <div>
          <h4 className="text-xs uppercase tracking-[0.2em]" style={{ color: "#C2A878" }}>Shop</h4>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link to="/shop/face-care" className="hover:text-white">Face Care</Link></li>
            <li><Link to="/shop/hair-care" className="hover:text-white">Hair Care</Link></li>
            <li><Link to="/shop/body-care" className="hover:text-white">Body Care</Link></li>
            <li><Link to="/shop/soaps" className="hover:text-white">Soaps</Link></li>
            <li><Link to="/shop/men" className="hover:text-white">Men Exclusive</Link></li>
            <li><Link to="/shop/kids" className="hover:text-white">Kids</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-xs uppercase tracking-[0.2em]" style={{ color: "#C2A878" }}>Help</h4>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link to="/profile" className="hover:text-white">Track Order</Link></li>
            <li><span className="text-[#A5B3AC]">Shipping &amp; Returns</span></li>
            <li><span className="text-[#A5B3AC]">Contact Us</span></li>
            <li><span className="text-[#A5B3AC]">FAQ</span></li>
          </ul>
        </div>
        <div>
          <h4 className="text-xs uppercase tracking-[0.2em]" style={{ color: "#C2A878" }}>Newsletter</h4>
          <p className="mt-4 text-sm text-[#A5B3AC]">Slow letters from our apothecary. No spam.</p>
          <form className="mt-4 flex border-b border-[#3A5249]" onSubmit={(e) => e.preventDefault()}>
            <input data-testid="footer-newsletter" placeholder="you@example.com" className="bg-transparent flex-1 py-2 text-sm outline-none placeholder:text-[#5C6B64]" />
            <button className="text-xs uppercase tracking-[0.18em]" style={{ color: "#C2A878" }}>Join</button>
          </form>
        </div>
      </div>
      <div className="border-t border-[#1A3B32] py-5 px-6 md:px-12 lg:px-20 flex flex-col md:flex-row justify-between gap-2 text-xs text-[#7E8D86]">
        <div>© {new Date().getFullYear()} Ayutree. All rights reserved.</div>
        <div>Made with care in India</div>
      </div>
    </footer>
  );
}
