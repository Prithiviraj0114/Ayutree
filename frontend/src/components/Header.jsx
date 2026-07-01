import { Link, NavLink, useNavigate } from "react-router-dom";
import { ShoppingBagOpen, MagnifyingGlass, UserCircle, List, X, Heart, SignOut } from "@phosphor-icons/react";
import { useState } from "react";
import Logo from "./Logo";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";

const navItems = [
  { to: "/", label: "Home", end: true },
  { to: "/shop/all", label: "Shop All" },
  { to: "/shop/face-care", label: "Face" },
  { to: "/shop/hair-care", label: "Hair" },
  { to: "/shop/body-care", label: "Body" },
  { to: "/shop/soaps", label: "Soaps" },
  { to: "/shop/men", label: "Men" },
  { to: "/shop/kids", label: "Kids" },
];

export default function Header() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const [open, setOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  const onSearch = (e) => {
    e.preventDefault();
    if (q.trim()) navigate(`/shop/all?q=${encodeURIComponent(q.trim())}`);
    setShowSearch(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 backdrop-blur-xl border-b" style={{ background: "rgba(249,246,240,0.85)", borderColor: "#E8E1D5" }}>
        <div className="px-6 md:px-12 lg:px-20 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button data-testid="mobile-menu-toggle" className="md:hidden" onClick={() => setOpen(true)} aria-label="menu">
              <List size={26} weight="light" />
            </button>
            <Logo />
          </div>
          <nav className="hidden md:flex items-center gap-8">
            {navItems.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                data-testid={`nav-${n.label.toLowerCase().replace(/\s/g, "-")}`}
                className={({ isActive }) =>
                  `text-xs uppercase tracking-[0.18em] font-medium transition-colors ${
                    isActive ? "text-[#1A3B32]" : "text-[#5C6B64] hover:text-[#1A3B32]"
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <button data-testid="search-toggle" onClick={() => setShowSearch((s) => !s)} aria-label="search">
              <MagnifyingGlass size={22} weight="light" />
            </button>
            {user ? (
              <div className="hidden md:flex items-center gap-3">
                <Link to="/wishlist" data-testid="nav-wishlist" aria-label="wishlist"><Heart size={22} weight="light" /></Link>
                <Link to={user.role === "admin" ? "/admin" : "/profile"} data-testid="nav-profile" className="text-xs uppercase tracking-[0.18em] font-medium text-[#1A3B32]">
                  {user.role === "admin" ? "Admin" : user.name?.split(" ")[0] || "Account"}
                </Link>
                <button data-testid="nav-logout" onClick={logout} aria-label="logout"><SignOut size={20} weight="light" /></button>
              </div>
            ) : (
              <Link to="/login" data-testid="nav-login" className="hidden md:inline text-xs uppercase tracking-[0.18em] font-medium text-[#1A3B32]">
                Sign In
              </Link>
            )}
            <Link to="/cart" data-testid="nav-cart" className="relative" aria-label="cart">
              <ShoppingBagOpen size={24} weight="light" />
              {count > 0 && (
                <span data-testid="cart-count" className="absolute -top-1.5 -right-2 text-[10px] font-semibold w-4 h-4 flex items-center justify-center rounded-full" style={{ background: "#1A3B32", color: "#F9F6F0" }}>{count}</span>
              )}
            </Link>
          </div>
        </div>

        {showSearch && (
          <form onSubmit={onSearch} className="px-6 md:px-12 lg:px-20 pb-4">
            <input
              data-testid="search-input"
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products, ingredients, rituals…"
              className="w-full bg-transparent border-b border-[#E8E1D5] focus:border-[#1A3B32] outline-none py-2 text-sm placeholder:text-[#9AA6A0]"
            />
          </form>
        )}
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute right-0 top-0 h-full w-[85%] max-w-sm p-6 flex flex-col bg-[#F9F6F0]">
            <div className="flex items-center justify-between mb-8">
              <Logo />
              <button data-testid="mobile-menu-close" onClick={() => setOpen(false)}><X size={24} weight="light" /></button>
            </div>
            <nav className="flex flex-col gap-5">
              {navItems.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  onClick={() => setOpen(false)}
                  className="text-base uppercase tracking-[0.18em] text-[#1A3B32]"
                >
                  {n.label}
                </NavLink>
              ))}
              <div className="border-t border-[#E8E1D5] pt-5 mt-2 flex flex-col gap-4">
                {user ? (
                  <>
                    <Link to={user.role === "admin" ? "/admin" : "/profile"} onClick={() => setOpen(false)} className="text-sm uppercase tracking-[0.18em] text-[#1A3B32]">
                      {user.role === "admin" ? "Admin Dashboard" : "My Account"}
                    </Link>
                    <Link to="/wishlist" onClick={() => setOpen(false)} className="text-sm uppercase tracking-[0.18em] text-[#1A3B32]">Wishlist</Link>
                    <button data-testid="mobile-logout" onClick={() => { logout(); setOpen(false); }} className="text-left text-sm uppercase tracking-[0.18em] text-[#9E473D]">Sign Out</button>
                  </>
                ) : (
                  <Link to="/login" onClick={() => setOpen(false)} className="text-sm uppercase tracking-[0.18em] text-[#1A3B32]">Sign In</Link>
                )}
              </div>
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
