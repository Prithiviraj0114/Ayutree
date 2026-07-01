import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

function getSessionId() {
  const hash = window.location.hash || "";
  const search = window.location.search || "";
  let params = new URLSearchParams(hash.replace(/^#/, ""));
  let session_id = params.get("session_id");
  if (!session_id) {
    params = new URLSearchParams(search.replace(/^\?/, ""));
    session_id = params.get("session_id");
  }
  return session_id;
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    const run = async () => {
      const session_id = getSessionId();
      if (!session_id) {
        toast.error("Google login did not complete. Please try again.");
        navigate("/login", { replace: true });
        return;
      }
      try {
        const { data } = await api.post("/auth/google/session", { session_id });
        if (data.token) localStorage.setItem("ayu_token", data.token);
        await refresh();
        navigate(data.role === "admin" ? "/admin" : "/", { replace: true });
      } catch (error) {
        console.error("Google auth callback failed", error);
        toast.error("Google login failed. Please try another method.");
        navigate("/login", { replace: true });
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
