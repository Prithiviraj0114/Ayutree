import { useEffect, useState } from "react";
import { Star, Trash } from "@phosphor-icons/react";
import api from "../../lib/api";
import { toast } from "sonner";

export default function AdminReviews() {
  const [reviews, setReviews] = useState([]);
  const [orders, setOrders] = useState([]);

  const load = () => {
    api.get("/admin/reviews").then((r) => setReviews(r.data));
    api.get("/admin/orders").then((r) => setOrders(r.data.filter((o) => o.status === "delivered" && !o.review_requested_at)));
  };
  useEffect(() => { load(); }, []);

  const del = async (id) => {
    if (!confirm("Delete this review?")) return;
    await api.delete(`/admin/reviews/${id}`);
    toast.success("Deleted");
    load();
  };

  const requestReview = async (orderId) => {
    try {
      const { data } = await api.post(`/admin/orders/${orderId}/request-review`);
      toast.success(data.email_sent ? "Review request emailed" : "Marked (email service not configured)");
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    }
  };

  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(2)
    : "—";

  return (
    <div data-testid="admin-reviews" className="space-y-8">
      <div>
        <div className="text-xs uppercase tracking-[0.25em]" style={{ color: "#C2A878" }}>Community</div>
        <h1 className="mt-2 font-serif-display text-4xl text-[#12221C]">Reviews</h1>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E8E1D5] p-5">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#5C6B64]">Total Reviews</div>
          <div className="font-serif-display text-3xl text-[#12221C] mt-1">{reviews.length}</div>
        </div>
        <div className="bg-white border border-[#E8E1D5] p-5">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#5C6B64]">Avg Rating</div>
          <div className="font-serif-display text-3xl text-[#12221C] mt-1 flex items-center gap-2">{avgRating} <Star size={20} weight="fill" color="#C2A878" /></div>
        </div>
        <div className="bg-white border border-[#E8E1D5] p-5">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#5C6B64]">Pending requests</div>
          <div className="font-serif-display text-3xl text-[#12221C] mt-1">{orders.length}</div>
        </div>
      </div>

      {orders.length > 0 && (
        <div className="bg-white border border-[#E8E1D5] p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-[#1A3B32]">Request reviews from delivered customers</div>
          <p className="text-xs text-[#5C6B64] mt-1">These orders have been delivered but no review request has been sent yet.</p>
          <div className="mt-4 divide-y divide-[#E8E1D5]">
            {orders.slice(0, 10).map((o) => (
              <div key={o.order_id} className="py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-sm">
                <div>
                  <div className="font-medium text-[#12221C]">#{o.order_id} — {o.address?.full_name}</div>
                  <div className="text-xs text-[#5C6B64]">{o.user_email} · {o.items.length} item(s) · delivered {new Date(o.created_at).toLocaleDateString()}</div>
                </div>
                <button
                  data-testid={`request-review-${o.order_id}`}
                  onClick={() => requestReview(o.order_id)}
                  className="px-4 py-2 text-xs uppercase tracking-[0.18em] border border-[#1A3B32] text-[#1A3B32] hover:bg-[#1A3B32] hover:text-white transition-colors w-fit"
                >
                  Email Review Request
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-[#E8E1D5]">
        <div className="px-5 py-3 border-b border-[#E8E1D5] text-xs uppercase tracking-[0.2em] text-[#5C6B64]">All Reviews</div>
        {reviews.length === 0 ? (
          <div className="p-6 text-sm text-[#5C6B64]">No reviews yet.</div>
        ) : (
          <div className="divide-y divide-[#E8E1D5]">
            {reviews.map((r) => (
              <div key={r.review_id} data-testid={`review-row-${r.review_id}`} className="p-5 flex flex-col md:flex-row gap-3 md:items-start md:justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="flex">{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={14} weight="fill" color={i < r.rating ? "#C2A878" : "#E8E1D5"} />)}</div>
                    <span className="text-xs text-[#5C6B64]">{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="mt-2 text-sm text-[#12221C]">{r.comment || <em className="text-[#9AA6A0]">(no comment)</em>}</div>
                  <div className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[#C2A878]">{r.user_name} · {r.product_name}</div>
                </div>
                <button data-testid={`delete-review-${r.review_id}`} onClick={() => del(r.review_id)} className="text-xs text-[#9E473D] inline-flex items-center gap-1 self-start"><Trash size={14} /> Delete</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
