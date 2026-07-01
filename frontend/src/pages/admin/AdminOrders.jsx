import { useEffect, useState } from "react";
import api, { formatInr, safeImg } from "../../lib/api";
import { toast } from "sonner";
import jsPDF from "jspdf";
import "jspdf-autotable";

const STATUSES = ["placed", "shipped", "delivered", "cancelled", "awaiting_payment"];

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [open, setOpen] = useState(null);

  const load = () => api.get("/admin/orders").then((r) => setOrders(r.data));
  useEffect(() => { load(); }, []);

  const updateStatus = async (id, status) => {
    await api.patch(`/admin/orders/${id}`, { status });
    toast.success("Updated");
    load();
  };

  const downloadCSV = () => {
    if (orders.length === 0) {
      toast.error("No orders to download");
      return;
    }
    const headers = [
      "Order ID", "Customer Name", "Customer Email", "Customer Phone", "Order Date",
      "Subtotal", "Discount", "Shipping", "Tax", "Total", "Payment Method", "Payment Status",
      "Order Status", "Shipping Line 1", "Shipping Line 2", "Shipping City", "Shipping State", "Shipping Pincode", "Order Items"
    ];
    const rows = orders.map((o) => {
      const itemsString = o.items.map(it => `${it.name} (Qty ${it.qty} x ₹${it.price})`).join(" | ");
      return [
        o.order_id,
        o.address?.full_name || "",
        o.user_email,
        o.address?.phone || "",
        new Date(o.created_at).toLocaleString(),
        o.subtotal,
        o.discount || 0,
        o.shipping,
        o.tax,
        o.total,
        o.payment_method,
        o.payment_status,
        o.status,
        o.address?.line1 || "",
        o.address?.line2 || "",
        o.address?.city || "",
        o.address?.state || "",
        o.address?.pincode || "",
        itemsString
      ];
    });
    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.map(val => {
        const strVal = String(val).replace(/"/g, '""');
        return `"${strVal}"`;
      }).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `orders_sales_report_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadPDF = () => {
    if (orders.length === 0) {
      toast.error("No orders to download");
      return;
    }
    const doc = new jsPDF("l", "pt", "a4");
    doc.setFontSize(18);
    doc.setTextColor(26, 59, 50);
    doc.text("Ayutree - Sales & Orders Report", 40, 40);
    doc.setFontSize(10);
    doc.setTextColor(92, 107, 100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 40, 55);

    const headers = [
      ["Order ID", "Customer", "Phone", "Date", "Items", "Payment", "Status", "Total"]
    ];

    const data = orders.map((o) => {
      const itemsString = o.items.map(it => `${it.name} (x${it.qty})`).join("\n");
      return [
        `#${o.order_id}`,
        o.address?.full_name || o.user_email,
        o.address?.phone || "",
        new Date(o.created_at).toLocaleDateString(),
        itemsString,
        `${o.payment_method}\n(${o.payment_status})`,
        o.status,
        `₹${o.total}`
      ];
    });

    doc.autoTable({
      head: headers,
      body: data,
      startY: 70,
      theme: "striped",
      headStyles: {
        fillColor: [26, 59, 50],
        textColor: [249, 246, 240],
        fontSize: 9,
        fontStyle: "bold"
      },
      bodyStyles: {
        fontSize: 8,
        valign: "middle"
      },
      columnStyles: {
        0: { width: 90 },
        1: { width: 120 },
        2: { width: 80 },
        3: { width: 60 },
        4: { width: 200 },
        5: { width: 80 },
        6: { width: 60 },
        7: { width: 60 }
      },
      margin: { top: 70, left: 40, right: 40 },
      didDrawPage: (data) => {
        const str = `Page ${doc.internal.getNumberOfPages()}`;
        doc.setFontSize(8);
        const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
        doc.text(str, data.settings.margin.left, pageHeight - 30);
      }
    });

    doc.save(`orders_sales_report_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div data-testid="admin-orders" className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <div className="text-xs uppercase tracking-[0.25em]" style={{ color: "#C2A878" }}>Operations</div>
          <h1 className="mt-2 font-serif-display text-4xl text-[#12221C]">Orders</h1>
        </div>
        <div className="flex gap-3">
          <button
            onClick={downloadCSV}
            className="px-5 py-3 border border-[#1A3B32] text-[#1A3B32] hover:bg-[#1A3B32] hover:text-[#F9F6F0] transition-colors text-xs uppercase tracking-[0.2em]"
          >
            Download CSV
          </button>
          <button
            onClick={downloadPDF}
            className="px-5 py-3 border border-[#1A3B32] text-[#1A3B32] hover:bg-[#1A3B32] hover:text-[#F9F6F0] transition-colors text-xs uppercase tracking-[0.2em]"
          >
            Download PDF
          </button>
        </div>
      </div>
      <div className="bg-white border border-[#E8E1D5] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-[0.2em] text-[#5C6B64] bg-[#F3EFE6]">
            <tr>
              <th className="text-left p-3">Order</th>
              <th className="text-left p-3">Customer</th>
              <th className="text-left p-3">Date</th>
              <th className="text-right p-3">Total</th>
              <th className="text-left p-3">Payment</th>
              <th className="text-left p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.order_id} data-testid={`admin-order-${o.order_id}`} className="border-t border-[#E8E1D5] cursor-pointer hover:bg-[#F9F6F0]" onClick={() => setOpen(o)}>
                <td className="p-3 font-medium text-[#12221C]">#{o.order_id}</td>
                <td className="p-3 text-[#5C6B64]">{o.user_email}</td>
                <td className="p-3 text-[#5C6B64]">{new Date(o.created_at).toLocaleString()}</td>
                <td className="p-3 text-right text-[#1A3B32]">{formatInr(o.total)}</td>
                <td className="p-3"><span className="text-[11px] uppercase tracking-[0.18em] px-2 py-1" style={{ background: o.payment_status === "paid" ? "#E6F0EA" : "#F8EFEC", color: o.payment_status === "paid" ? "#2D5A46" : "#9E473D" }}>{o.payment_method}/{o.payment_status}</span></td>
                <td className="p-3">
                  {["delivered", "cancelled"].includes(o.status) ? (
                    <span className="text-[11px] uppercase tracking-[0.18em] px-2 py-1 bg-[#F3EFE6] text-[#5C6B64] border border-[#E8E1D5]">
                      {o.status}
                    </span>
                  ) : (
                    <select data-testid={`order-status-${o.order_id}`} value={o.status} onClick={(e) => e.stopPropagation()} onChange={(e) => updateStatus(o.order_id, e.target.value)} className="bg-transparent border border-[#E8E1D5] px-2 py-1 text-xs outline-none">
                      {o.status === "shipped" ? (
                        <>
                          <option value="shipped">shipped</option>
                          <option value="delivered">delivered</option>
                        </>
                      ) : (
                        <>
                          <option value={o.status}>{o.status}</option>
                          {o.status !== "placed" && <option value="placed">placed</option>}
                          <option value="shipped">shipped</option>
                          <option value="cancelled">cancelled</option>
                        </>
                      )}
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && <div className="text-sm text-[#5C6B64] p-6">No orders yet.</div>}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(null)} />
          <div className="relative w-full max-w-xl h-full bg-white overflow-y-auto p-6 md:p-8">
            <h2 className="font-serif-display text-3xl text-[#12221C]">Order #{open.order_id}</h2>
            <div className="mt-2 text-sm text-[#5C6B64]">{new Date(open.created_at).toLocaleString()}</div>
            <div className="mt-6">
              <div className="text-xs uppercase tracking-[0.2em] text-[#C2A878]">Customer</div>
              <div className="mt-1 text-[#12221C]">{open.address?.full_name} • {open.user_email}</div>
              <div className="text-sm text-[#5C6B64]">{open.address?.phone}</div>
              <div className="text-sm text-[#5C6B64] mt-1">{open.address?.line1}, {open.address?.line2}, {open.address?.city}, {open.address?.state} {open.address?.pincode}</div>
            </div>
            <div className="mt-6">
              <div className="text-xs uppercase tracking-[0.2em] text-[#C2A878]">Items</div>
              <div className="mt-3 space-y-3">
                {open.items.map((it, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <img src={safeImg(it.image)} alt="" className="w-12 h-14 object-cover bg-[#F3EFE6]" />
                    <div className="flex-1">
                      <div className="font-medium text-[#12221C]">{it.name}</div>
                      <div className="text-xs text-[#5C6B64]">Qty {it.qty} × {formatInr(it.price)}</div>
                    </div>
                    <div className="text-[#1A3B32]">{formatInr(it.total)}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-6 border-t border-[#E8E1D5] pt-4 text-sm space-y-2">
              <div className="flex justify-between text-[#5C6B64]"><span>Subtotal</span><span>{formatInr(open.subtotal)}</span></div>
              <div className="flex justify-between text-[#5C6B64]"><span>Shipping</span><span>{formatInr(open.shipping)}</span></div>
              <div className="flex justify-between text-[#5C6B64]"><span>Tax</span><span>{formatInr(open.tax)}</span></div>
              <div className="flex justify-between text-base font-medium text-[#12221C]"><span>Total</span><span>{formatInr(open.total)}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
