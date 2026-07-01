import { useState } from "react";
import { Star } from "@phosphor-icons/react";
import api, { formatErr } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export default function ReviewForm({ productId, onSubmitted }) {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  if (!user) {
    return (
      <div data-testid="review-signin-prompt" className="border border-[#E8E1D5] p-5 bg-white">
        <p className="text-sm text-[#5C6B64]">
          <Link to="/login" className="text-[#1A3B32] underline underline-offset-4">Sign in</Link> to leave a review.
        </p>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    if (rating < 1) { toast.error("Please choose a star rating"); return; }
    setBusy(true);
    try {
      await api.post("/reviews", { product_id: productId, rating, comment });
      toast.success("Thank you for your review");
      setRating(0); setComment("");
      onSubmitted?.();
    } catch (err) {
      toast.error(formatErr(err.response?.data?.detail) || "Could not submit");
    } finally { setBusy(false); }
  };

  return (
    <form data-testid="review-form" onSubmit={submit} className="border border-[#E8E1D5] p-5 bg-white">
      <div className="text-xs uppercase tracking-[0.2em]" style={{ color: "#C2A878" }}>Share your ritual</div>
      <h3 className="font-serif-display text-2xl text-[#12221C] mt-1">Write a review</h3>
      <div className="mt-4 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            data-testid={`star-${n}`}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(n)}
            className="p-1"
            aria-label={`${n} stars`}
          >
            <Star size={22} weight={(hover || rating) >= n ? "fill" : "regular"} color={(hover || rating) >= n ? "#C2A878" : "#9AA6A0"} />
          </button>
        ))}
        <span className="ml-2 text-xs text-[#5C6B64]">{rating > 0 ? `${rating} of 5` : "Choose your rating"}</span>
      </div>
      <label className="block mt-4">
        <span className="text-[10px] uppercase tracking-[0.2em] text-[#C2A878]">Your notes</span>
        <textarea
          data-testid="review-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          placeholder="What did you love about it?"
          className="mt-1 w-full bg-transparent border border-[#E8E1D5] focus:border-[#1A3B32] outline-none p-3 text-sm"
        />
      </label>
      <button data-testid="review-submit" disabled={busy} className="mt-4 px-6 py-3 text-xs uppercase tracking-[0.2em] disabled:opacity-60" style={{ background: "#1A3B32", color: "#F9F6F0" }}>
        {busy ? "Submitting…" : "Post Review"}
      </button>
    </form>
  );
}
