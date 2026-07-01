import { useEffect, useState } from "react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts";
import { Package, Users, ShoppingBag, CurrencyInr } from "@phosphor-icons/react";
import api, { formatInr } from "../../lib/api";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  useEffect(() => { api.get("/admin/stats").then((r) => setStats(r.data)); }, []);
  if (!stats) return <div className="text-sm text-[#5C6B64]">Loading…</div>;

  const cards = [
    { label: "Revenue", value: formatInr(stats.revenue), icon: CurrencyInr },
    { label: "Orders", value: stats.total_orders, icon: ShoppingBag },
    { label: "Customers", value: stats.total_customers, icon: Users },
    { label: "Products", value: stats.total_products, icon: Package },
  ];

  return (
    <div data-testid="admin-dashboard" className="space-y-8">
      <div>
        <div className="text-xs uppercase tracking-[0.25em]" style={{ color: "#C2A878" }}>Overview</div>
        <h1 className="mt-2 font-serif-display text-4xl text-[#12221C]">Dashboard</h1>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} data-testid={`stat-${c.label.toLowerCase()}`} className="bg-white border border-[#E8E1D5] p-5">
            <div className="flex items-center justify-between text-[#5C6B64]"><span className="text-xs uppercase tracking-[0.18em]">{c.label}</span><c.icon size={20} weight="light" /></div>
            <div className="mt-2 font-serif-display text-3xl text-[#12221C]">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-[#E8E1D5] p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-[#5C6B64]">Sales — Last 7 days</div>
          <div className="h-72 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.sales_chart}>
                <CartesianGrid stroke="#E8E1D5" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="#5C6B64" tick={{ fontSize: 11 }} />
                <YAxis stroke="#5C6B64" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#FFF", border: "1px solid #E8E1D5", borderRadius: 0 }} />
                <Line type="monotone" dataKey="total" stroke="#1A3B32" strokeWidth={2} dot={{ r: 3, fill: "#C2A878" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white border border-[#E8E1D5] p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-[#5C6B64]">Top Products</div>
          <div className="h-72 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.top_products}>
                <CartesianGrid stroke="#E8E1D5" strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="#5C6B64" tick={{ fontSize: 10 }} angle={-12} textAnchor="end" height={60} />
                <YAxis stroke="#5C6B64" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#FFF", border: "1px solid #E8E1D5", borderRadius: 0 }} />
                <Bar dataKey="qty" fill="#C2A878" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#E8E1D5] p-5">
        <div className="text-xs uppercase tracking-[0.18em] text-[#5C6B64] mb-4">Low Stock</div>
        {stats.low_stock.length === 0 ? (
          <div className="text-sm text-[#5C6B64]">All items healthy.</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {stats.low_stock.map((p) => (
              <div key={p.product_id} className="flex items-center gap-3 border border-[#E8E1D5] p-3">
                <img src={p.image} alt="" className="w-12 h-12 object-cover bg-[#F3EFE6]" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-[#12221C]">{p.name}</div>
                  <div className="text-xs text-[#9E473D]">Stock: {p.stock}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
