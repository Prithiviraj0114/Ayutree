import { useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import api, { formatErr } from "../lib/api";
import { toast } from "sonner";

export default function ResetPassword() {
  const [search] = useSearchParams();
  const token = search.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) { toast.error("Passwords do not match"); return; }
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setBusy(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      toast.success("Password updated. Please sign in.");
      navigate("/login", { replace: true });
    } catch (err) {
      toast.error(formatErr(err.response?.data?.detail) || "Could not reset password");
    } finally { setBusy(false); }
  };

  if (!token) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6">
        <div className="text-center">
          <p className="font-serif-display text-2xl">Missing or invalid reset link</p>
          <Link to="/forgot-password" className="inline-block mt-6 px-6 py-3 text-xs uppercase tracking-[0.2em]" style={{ background: "#1A3B32", color: "#F9F6F0" }}>Request a new link</Link>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="reset-page" className="min-h-[70vh] flex items-center justify-center px-6">
      <div className="w-full max-w-md py-16">
        <h1 className="font-serif-display text-4xl text-[#12221C]">Choose a new password</h1>
        <p className="text-sm text-[#5C6B64] mt-2">Make it strong — at least 6 characters.</p>
        <form onSubmit={submit} className="mt-8 space-y-5">
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#C2A878]">New password</span>
            <input data-testid="reset-password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full bg-transparent border-b border-[#E8E1D5] focus:border-[#1A3B32] outline-none py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#C2A878]">Confirm password</span>
            <input data-testid="reset-confirm" type="password" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1 w-full bg-transparent border-b border-[#E8E1D5] focus:border-[#1A3B32] outline-none py-2 text-sm" />
          </label>
          <button data-testid="reset-submit" disabled={busy} className="w-full py-3.5 text-xs uppercase tracking-[0.2em] disabled:opacity-60" style={{ background: "#1A3B32", color: "#F9F6F0" }}>
            {busy ? "Updating…" : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
