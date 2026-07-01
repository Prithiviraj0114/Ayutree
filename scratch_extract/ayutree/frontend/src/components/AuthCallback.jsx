import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function AuthCallback() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    const run = async () => {
      const hash = window.location.hash || "";
      const params = new URLSearchParams(hash.replace(/^#/, ""));
      const session_id = params.get("session_id");
      if (!session_id) { navigate("/login"); return; }
      try {
        const { data } = await api.post("/auth/google/session", { session_id });
        if (data.token) localStorage.setItem("ayu_token", data.token);
        await refresh();
        navigate(data.role === "admin" ? "/admin" : "/", { replace: true });
      } catch {
        navigate("/login");
      }
    };
    run();
  }, [navigate, refresh]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center font-serif-display text-2xl text-[#1A3B32]">
      Preparing your apothecary…
    </div>
  );
}
