import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api, { formatErr } from "../lib/api";
import { toast } from "sonner";
import { GoogleLogo } from "@phosphor-icons/react";
import { useGoogleLogin } from "@react-oauth/google";

export default function Login() {
  const { login, refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const user = await login(email, password);
      toast.success(`Welcome, ${user.name?.split(" ")[0] || ""}`);
      const target = location.state?.from?.pathname || (user.role === "admin" ? "/admin" : "/");
      navigate(target, { replace: true });
    } catch (err) {
      toast.error(formatErr(err.response?.data?.detail) || "Login failed");
    } finally { setBusy(false); }
  };

  const nativeGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setBusy(true);
      try {
        const { data } = await api.post("/auth/google/native", { access_token: tokenResponse.access_token });
        if (data.token) localStorage.setItem("ayu_token", data.token);
        await refresh();
        toast.success(`Welcome, ${data.name?.split(" ")[0] || ""}`);
        const target = location.state?.from?.pathname || (data.role === "admin" ? "/admin" : "/");
        navigate(target, { replace: true });
      } catch (err) {
        toast.error("Google Login failed on backend");
      } finally { setBusy(false); }
    },
    onError: () => {
      toast.error("Google Login popup failed or was closed");
    }
  });

  return (
    <div data-testid="login-page" className="min-h-[80vh] grid md:grid-cols-2">
      <div className="hidden md:block relative">
        <img src="https://ayutree.com/cdn/shop/collections/pexels-sora-shimazaki-5938261_1.jpg?v=1699334573&width=750" />
        <div className="absolute inset-0 bg-[#1A3B32]/40" />
        <div className="absolute inset-0 p-12 flex flex-col justify-end text-white">
          <div className="text-xs uppercase tracking-[0.3em]" style={{ color: "#C2A878" }}>Welcome back</div>
          <p className="mt-3 font-serif-display text-4xl font-light leading-tight">Continue your<br /><em>ayurvedic ritual.</em></p>
        </div>
      </div>
      <div className="flex items-center justify-center px-6 md:px-16 py-16">
        <div className="w-full max-w-md">
          <h1 className="font-serif-display text-4xl text-[#12221C]">Sign in</h1>
          <p className="text-sm text-[#5C6B64] mt-2">No account? <Link to="/register" className="text-[#1A3B32] underline underline-offset-4">Create one</Link></p>

          <button data-testid="google-login-btn" onClick={() => nativeGoogleLogin()} disabled={busy} className="mt-8 w-full flex items-center justify-center gap-3 py-3.5 border border-[#1A3B32] text-[#1A3B32] hover:bg-[#1A3B32] hover:text-white transition-colors text-xs uppercase tracking-[0.2em] disabled:opacity-50">
            <GoogleLogo size={18} weight="light" /> Continue with Google
          </button>
          <div className="my-6 flex items-center gap-3 text-[10px] uppercase tracking-[0.25em] text-[#9AA6A0]">
            <div className="flex-1 h-px bg-[#E8E1D5]" /> or with email <div className="flex-1 h-px bg-[#E8E1D5]" />
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#C2A878]">Email</span>
              <input data-testid="login-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full bg-transparent border-b border-[#E8E1D5] focus:border-[#1A3B32] outline-none py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#C2A878]">Password</span>
              <input data-testid="login-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full bg-transparent border-b border-[#E8E1D5] focus:border-[#1A3B32] outline-none py-2 text-sm" />
            </label>
            <button data-testid="login-submit" disabled={busy} className="w-full py-3.5 text-xs uppercase tracking-[0.2em] disabled:opacity-60" style={{ background: "#1A3B32", color: "#F9F6F0" }}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <p className="mt-6 text-xs"><Link to="/forgot-password" data-testid="forgot-link" className="text-[#1A3B32] underline underline-offset-4">Forgot password?</Link></p>
        </div>
      </div>
    </div>
  );
}
