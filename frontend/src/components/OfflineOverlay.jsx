import { useState, useEffect } from "react";
import { WifiSlash, SpinnerGap, Sparkle } from "@phosphor-icons/react";

export default function OfflineOverlay() {
  const [isAlertActive, setIsAlertActive] = useState(false);
  const [reason, setReason] = useState("offline"); // offline | slow

  useEffect(() => {
    const checkConnection = () => {
      // 1. Check offline status
      if (!navigator.onLine) {
        setReason("offline");
        setIsAlertActive(true);
        return;
      }

      // 2. Check for slow connection using Network Information API
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (conn) {
        const type = conn.effectiveType;
        if (type === "slow-2g" || type === "2g") {
          setReason("slow");
          setIsAlertActive(true);
          return;
        }
      }

      // If everything is fine, clear the overlay
      setIsAlertActive(false);
    };

    // Initial check
    checkConnection();

    // Event Listeners for browser online/offline states
    window.addEventListener("online", checkConnection);
    window.addEventListener("offline", checkConnection);

    // Event Listener for network connection speed changes
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) {
      conn.addEventListener("change", checkConnection);
    }

    return () => {
      window.removeEventListener("online", checkConnection);
      window.removeEventListener("offline", checkConnection);
      if (conn) {
        conn.removeEventListener("change", checkConnection);
      }
    };
  }, []);

  if (!isAlertActive) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-xl bg-[#12221C]/95 text-[#F9F6F0] p-6 animate-fade-in">
      <div className="max-w-md w-full text-center space-y-6 flex flex-col items-center">
        
        {/* Animated Icon Ring */}
        <div className="relative flex items-center justify-center">
          <div className="w-24 h-24 rounded-full border border-[#C2A878]/30 flex items-center justify-center text-[#C2A878] animate-pulse">
            <WifiSlash size={40} weight="light" />
          </div>
          <div className="absolute inset-0 w-24 h-24 rounded-full border border-t-[#C2A878] animate-spin" style={{ animationDuration: "3s" }} />
        </div>

        {/* Brand Header */}
        <div className="flex items-center gap-1.5 justify-center text-[#C2A878]">
          <Sparkle size={12} weight="fill" />
          <span className="text-[10px] uppercase tracking-[0.3em] font-medium">Ayutree Sanctuary</span>
          <Sparkle size={12} weight="fill" />
        </div>

        {/* Text Details */}
        <div className="space-y-3">
          <h2 className="font-serif-display text-2xl md:text-3xl font-light leading-tight">
            {reason === "offline" ? "Connecting to the Ritual..." : "Slowing Down..."}
          </h2>
          <p className="text-sm text-[#E8E1D5] font-light leading-relaxed max-w-sm mx-auto">
            {reason === "offline"
              ? "It looks like you're offline. We're waiting for a stable signal to resume your Ayurvedic journey."
              : "Your connection is currently very slow. We are optimizing our botanical sanctuary for your speed."}
          </p>
        </div>

        {/* Loading status bar */}
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#C2A878]/80 font-medium bg-[#1A3B32] border border-[#C2A878]/20 px-4 py-2 rounded-full shadow-sm">
          <SpinnerGap size={14} className="animate-spin" />
          Reconnecting...
        </div>

      </div>
    </div>
  );
}
