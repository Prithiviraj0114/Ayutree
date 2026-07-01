import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { formatErr } from "../lib/api";
import { toast } from "sonner";
import { GoogleLogo } from "@phosphor-icons/react";

export default function Register() {
  const { register, loginWithGoogle } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await register(name, email, password);
      toast.success("Welcome to Ayutree");
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(formatErr(err.response?.data?.detail) || "Could not create account");
    } finally { setBusy(false); }
  };

  return (
    <div data-testid="register-page" className="min-h-[80vh] grid md:grid-cols-2">
      <div className="flex items-center justify-center px-6 md:px-16 py-16 order-2 md:order-1">
        <div className="w-full max-w-md">
          <h1 className="font-serif-display text-4xl text-[#12221C]">Create your account</h1>
          <p className="text-sm text-[#5C6B64] mt-2">Already with us? <Link to="/login" className="text-[#1A3B32] underline underline-offset-4">Sign in</Link></p>

          <button data-testid="google-register-btn" onClick={loginWithGoogle} className="mt-8 w-full flex items-center justify-center gap-3 py-3.5 border border-[#1A3B32] text-[#1A3B32] hover:bg-[#1A3B32] hover:text-white transition-colors text-xs uppercase tracking-[0.2em]">
            <GoogleLogo size={18} weight="light" /> Sign up with Google
          </button>
          <div className="my-6 flex items-center gap-3 text-[10px] uppercase tracking-[0.25em] text-[#9AA6A0]">
            <div className="flex-1 h-px bg-[#E8E1D5]" /> or <div className="flex-1 h-px bg-[#E8E1D5]" />
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#C2A878]">Full name</span>
              <input data-testid="register-name" required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full bg-transparent border-b border-[#E8E1D5] focus:border-[#1A3B32] outline-none py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#C2A878]">Email</span>
              <input data-testid="register-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full bg-transparent border-b border-[#E8E1D5] focus:border-[#1A3B32] outline-none py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#C2A878]">Password</span>
              <input data-testid="register-password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full bg-transparent border-b border-[#E8E1D5] focus:border-[#1A3B32] outline-none py-2 text-sm" />
            </label>
            <button data-testid="register-submit" disabled={busy} className="w-full py-3.5 text-xs uppercase tracking-[0.2em] disabled:opacity-60" style={{ background: "#1A3B32", color: "#F9F6F0" }}>
              {busy ? "Creating…" : "Create account"}
            </button>
          </form>
        </div>
      </div>
      <div className="hidden md:block relative order-1 md:order-2">
        <img src="https://images.unsplash.com/photo-1748543668676-ea8241cb3886" alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-[#1A3B32]/30" />
        <div className="absolute inset-0 p-12 flex flex-col justify-end text-white">
          <div className="text-xs uppercase tracking-[0.3em]" style={{ color: "#C2A878" }}>Join Ayutree</div>
          <p className="mt-3 font-serif-display text-4xl font-light leading-tight">Begin your<br /><em>slow beauty</em> journey.</p>
        </div>
      </div>
    </div>
  );
}
