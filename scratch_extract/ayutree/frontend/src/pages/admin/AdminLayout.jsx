import { NavLink, Outlet, Link } from "react-router-dom";
import { House, Package, ShoppingBag, Users, ChartBar, SignOut } from "@phosphor-icons/react";
import { useAuth } from "../../contexts/AuthContext";

const links = [
  { to: "/admin", label: "Dashboard", icon: ChartBar, end: true },
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { to: "/admin/customers", label: "Customers", icon: Users },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  return (
    <div data-testid="admin-layout" className="min-h-screen grid md:grid-cols-[260px_1fr]" style={{ background: "#F9F6F0" }}>
      <aside className="border-r border-[#E8E1D5] bg-white md:sticky md:top-0 md:h-screen flex flex-col">
        <Link to="/" className="px-6 py-6 border-b border-[#E8E1D5] block">
          <div className="text-xs uppercase tracking-[0.3em]" style={{ color: "#C2A878" }}>Ayutree</div>
          <div className="font-serif-display text-2xl text-[#12221C]">Admin Console</div>
        </Link>
        <nav className="px-3 py-6 flex-1 overflow-auto">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              data-testid={`admin-nav-${l.label.toLowerCase()}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 text-sm font-medium ${
                  isActive ? "bg-[#1A3B32] text-[#F9F6F0]" : "text-[#5C6B64] hover:bg-[#F3EFE6]"
                }`
              }
            >
              <l.icon size={18} weight="light" /> {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-6 py-5 border-t border-[#E8E1D5]">
          <div className="text-xs text-[#5C6B64]">Signed in as</div>
          <div className="font-medium text-[#12221C]">{user?.name}</div>
          <div className="mt-3 flex gap-3 text-xs">
            <Link to="/" className="flex items-center gap-1 text-[#1A3B32]"><House size={14} /> Site</Link>
            <button data-testid="admin-logout" onClick={logout} className="flex items-center gap-1 text-[#9E473D]"><SignOut size={14} /> Sign out</button>
          </div>
        </div>
      </aside>
      <main className="p-6 md:p-10">
        <Outlet />
      </main>
    </div>
  );
}
