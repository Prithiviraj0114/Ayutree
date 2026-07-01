import { useEffect, useState } from "react";
import api, { formatInr } from "../../lib/api";

export default function AdminCustomers() {
  const [list, setList] = useState([]);
  useEffect(() => { api.get("/admin/customers").then((r) => setList(r.data)); }, []);
  return (
    <div data-testid="admin-customers" className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.25em]" style={{ color: "#C2A878" }}>Community</div>
        <h1 className="mt-2 font-serif-display text-4xl text-[#12221C]">Customers</h1>
      </div>
      <div className="bg-white border border-[#E8E1D5] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-[0.2em] text-[#5C6B64] bg-[#F3EFE6]">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Auth</th>
              <th className="text-right p-3">Orders</th>
              <th className="text-right p-3">Total Spend</th>
            </tr>
          </thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.user_id} className="border-t border-[#E8E1D5]">
                <td className="p-3 font-medium text-[#12221C]">{u.name}</td>
                <td className="p-3 text-[#5C6B64]">{u.email}</td>
                <td className="p-3 text-[#5C6B64]">{u.auth_provider || "local"}</td>
                <td className="p-3 text-right">{u.orders_count || 0}</td>
                <td className="p-3 text-right text-[#1A3B32]">{formatInr(u.total_spend || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <div className="text-sm text-[#5C6B64] p-6">No customers yet.</div>}
      </div>
    </div>
  );
}
