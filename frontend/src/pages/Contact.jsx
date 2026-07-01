import { useState } from "react";
import { Envelope, Phone, MapPin, Sparkle, Clock } from "@phosphor-icons/react";
import { toast } from "sonner";
import api from "../lib/api";

export default function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/contact", { name, email, subject, message });
      toast.success("Thank you! Your message has been sent successfully. We will get back to you within 24 hours.");
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to send message. Please try again later.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="contact-page" className="min-h-[80vh] bg-[#F9F6F0] py-16 px-6 md:px-12 lg:px-20">
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 border border-[#C2A878] text-[#C2A878] mb-4">
            <Sparkle size={12} weight="fill" />
            <span className="text-[10px] uppercase tracking-[0.25em]">Connect with Us</span>
          </div>
          <h1 className="font-serif-display text-4xl md:text-5xl text-[#12221C] font-light">We are here to guide you</h1>
          <p className="mt-4 text-sm text-[#5C6B64] leading-relaxed">
            Have questions about our traditional recipes, custom formulations, or an order? Our apothecary consultants are ready to assist you on your wellness journey.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-start mt-8">
          {/* Info Column */}
          <div className="space-y-8 bg-white border border-[#E8E1D5] p-8 md:p-10 rounded-lg shadow-sm">
            <h2 className="font-serif-display text-2xl text-[#12221C] border-b border-[#E8E1D5] pb-4 mb-6">Apothecary Details</h2>
            
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-[#1A3B32]/5 flex items-center justify-center text-[#1A3B32] shrink-0">
                <Phone size={20} weight="light" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-[#C2A878] font-medium">Call/WhatsApp</div>
                <div className="text-sm text-[#12221C] font-light mt-1">+91 9791975741</div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-[#1A3B32]/5 flex items-center justify-center text-[#1A3B32] shrink-0">
                <Envelope size={20} weight="light" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-[#C2A878] font-medium">Email Us</div>
                <div className="text-sm text-[#12221C] font-light mt-1">prithiviraj0114@gmail.com</div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-[#1A3B32]/5 flex items-center justify-center text-[#1A3B32] shrink-0">
                <MapPin size={20} weight="light" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-[#C2A878] font-medium">Location</div>
                <div className="text-sm text-[#12221C] font-light mt-1">
                  Ayutree Apothecary,<br />
                  Erode, Tamil Nadu, India
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-[#1A3B32]/5 flex items-center justify-center text-[#1A3B32] shrink-0">
                <Clock size={20} weight="light" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-[#C2A878] font-medium">Consulting Hours</div>
                <div className="text-sm text-[#12221C] font-light mt-1">Mon - Sat: 9:00 AM - 6:00 PM IST</div>
              </div>
            </div>
          </div>

          {/* Form Column */}
          <div className="bg-white border border-[#E8E1D5] p-8 md:p-10 rounded-lg shadow-sm">
            <h2 className="font-serif-display text-2xl text-[#12221C] border-b border-[#E8E1D5] pb-4 mb-6">Send a Message</h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#C2A878]">Full Name</span>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full bg-transparent border-b border-[#E8E1D5] focus:border-[#1A3B32] outline-none py-2 text-sm transition-colors"
                />
              </div>

              <div>
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#C2A878]">Email Address</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full bg-transparent border-b border-[#E8E1D5] focus:border-[#1A3B32] outline-none py-2 text-sm transition-colors"
                />
              </div>

              <div>
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#C2A878]">Subject</span>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="mt-1 w-full bg-transparent border-b border-[#E8E1D5] focus:border-[#1A3B32] outline-none py-2 text-sm transition-colors"
                />
              </div>

              <div>
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#C2A878]">Message</span>
                <textarea
                  rows={4}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="mt-1 w-full bg-transparent border-b border-[#E8E1D5] focus:border-[#1A3B32] outline-none py-2 text-sm resize-none transition-colors"
                  placeholder="Tell us about your concerns or query..."
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-4 text-xs uppercase tracking-[0.2em] transition-transform hover:translate-y-[-1px] active:translate-y-0 disabled:opacity-60"
                style={{ background: "#1A3B32", color: "#F9F6F0" }}
              >
                {busy ? "Sending Message…" : "Send Message"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
