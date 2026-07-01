import { useState } from "react";
import { Link } from "react-router-dom";
import api, { formatErr } from "../lib/api";
import { toast } from "sonner";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      toast.error(formatErr(err.response?.data?.detail) || "Could not send reset email");
    } finally { setBusy(false); }
  };

  return (
    <div data-testid="forgot-page" className="min-h-[70vh] flex items-center justify-center px-6">
      <div className="w-full max-w-md py-16">
        <Link to="/login" className="text-xs uppercase tracking-[0.18em] text-[#5C6B64]">← Back to sign in</Link>
        <h1 className="font-serif-display text-4xl text-[#12221C] mt-4">Reset your password</h1>
        {sent ? (
          <div className="mt-8 p-5 border border-[#1A3B32] bg-[#F3EFE6]">
            <div className="text-xs uppercase tracking-[0.2em]" style={{ color: "#1A3B32" }}>Email sent</div>
            <p className="mt-2 text-sm text-[#12221C]">If an account exists for <b>{email}</b>, we've sent a password-reset link. The link expires in 1 hour. Check your inbox (and spam folder).</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-[#5C6B64] mt-2">Enter your email and we'll send you a secure link.</p>
            <form onSubmit={submit} className="mt-8 space-y-5">
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#C2A878]">Email</span>
                <input data-testid="forgot-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full bg-transparent border-b border-[#E8E1D5] focus:border-[#1A3B32] outline-none py-2 text-sm" />
              </label>
              <button data-testid="forgot-submit" disabled={busy} className="w-full py-3.5 text-xs uppercase tracking-[0.2em] disabled:opacity-60" style={{ background: "#1A3B32", color: "#F9F6F0" }}>
                {busy ? "Sending…" : "Send Reset Link"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
