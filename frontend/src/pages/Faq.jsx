import { useState } from "react";
import { Sparkle, CaretDown, CaretUp, MagnifyingGlass } from "@phosphor-icons/react";

const FAQ_DATA = [
  {
    category: "Products & Safety",
    q: "Are Ayutree products 100% natural?",
    a: "Yes! All our products are handcrafted in small batches using 100% natural, certified organic botanical-first ingredients. We strictly avoid parabens, sulphates, synthetic colorants, silicones, and harmful chemical preservatives."
  },
  {
    category: "Products & Safety",
    q: "How should I store these organic products?",
    a: "Because our products are made without harsh synthetic preservatives, we recommend storing them in a cool, dry place away from direct sunlight. Always close the lids tightly and avoid letting moisture inside powder jars."
  },
  {
    category: "Products & Safety",
    q: "Are the lip scrubs and balms safe if accidentally ingested?",
    a: "Absolutely. Our lip care range (lip balms and scrubs) is formulated using food-grade natural ingredients like real beetroot extracts, raw cane sugar, honey, and cold-pressed oils. They are completely non-toxic and safe."
  },
  {
    category: "Orders & Shipping",
    q: "How much does shipping cost?",
    a: "We offer Free Shipping on all orders above ₹499 within India. For orders below ₹499, a flat shipping fee of ₹49 is applied during checkout."
  },
  {
    category: "Orders & Shipping",
    q: "How long will it take to receive my order?",
    a: "Orders are dispatched from our apothecary within 24-48 hours. Depending on your location, delivery takes between 3 to 7 business days. You will receive an SMS and email notification with tracking details once dispatched."
  },
  {
    category: "Orders & Shipping",
    q: "What payment methods do you accept?",
    a: "We accept Cash on Delivery (COD) as well as secure online payments (UPI, Credit Cards, Debit Cards, Net Banking) powered securely by Cashfree Payments."
  },
  {
    category: "Returns & Refunds",
    q: "What is your return policy?",
    a: "We offer easy returns within 7 days of delivery. If you receive a damaged, leaked, or wrong product, please contact us immediately on WhatsApp or email with photos, and we will arrange a replacement or refund."
  },
  {
    category: "Returns & Refunds",
    q: "How do I get my refund?",
    a: "Refunds for online orders are credited back to the original payment source within 5-7 business days of initiating the request. For Cash on Delivery orders, we will contact you to request your bank account or UPI details for transfer."
  }
];

export default function Faq() {
  const [openIdx, setOpenIdx] = useState(null);
  const [search, setSearch] = useState("");

  const toggle = (idx) => {
    setOpenIdx(openIdx === idx ? null : idx);
  };

  const filteredFaqs = FAQ_DATA.filter(
    (item) =>
      item.q.toLowerCase().includes(search.toLowerCase()) ||
      item.a.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div data-testid="faq-page" className="min-h-[80vh] bg-[#F9F6F0] py-16 px-6 md:px-12 lg:px-20">
      <div className="max-w-4xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 border border-[#C2A878] text-[#C2A878] mb-4">
            <Sparkle size={12} weight="fill" />
            <span className="text-[10px] uppercase tracking-[0.25em]">Self Service Help</span>
          </div>
          <h1 className="font-serif-display text-4xl md:text-5xl text-[#12221C] font-light">Frequently Asked Questions</h1>
          <p className="mt-4 text-sm text-[#5C6B64] leading-relaxed">
            Find quick answers to common queries regarding our organic ingredients, shipping timelines, payments, and replacements.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-md mx-auto mb-12">
          <MagnifyingGlass size={18} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#5C6B64]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search FAQs (e.g. shipping, ingredients...)"
            className="w-full pl-12 pr-4 py-3 text-sm bg-white border border-[#E8E1D5] focus:border-[#1A3B32] outline-none rounded-md transition-colors placeholder:text-[#9AA6A0]"
          />
        </div>

        {/* FAQ list */}
        {filteredFaqs.length > 0 ? (
          <div className="space-y-4">
            {filteredFaqs.map((faq, idx) => {
              const isOpen = openIdx === idx;
              return (
                <div
                  key={idx}
                  className="bg-white border border-[#E8E1D5] overflow-hidden rounded-md transition-all duration-300"
                >
                  <button
                    onClick={() => toggle(idx)}
                    className="w-full text-left px-6 py-5 flex justify-between items-center gap-4 hover:bg-[#F3EFE6]/30 transition-colors"
                  >
                    <div>
                      <span className="text-[9px] uppercase tracking-[0.18em] text-[#C2A878] block mb-1 font-medium">
                        {faq.category}
                      </span>
                      <span className="text-base font-serif-display text-[#12221C]">{faq.q}</span>
                    </div>
                    <div className="text-[#1A3B32]">
                      {isOpen ? <CaretUp size={18} /> : <CaretDown size={18} />}
                    </div>
                  </button>
                  
                  {isOpen && (
                    <div className="px-6 pb-6 pt-1 text-sm text-[#5C6B64] leading-relaxed font-light border-t border-[#F3EFE6] bg-[#F9F6F0]/20">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-[#5C6B64]">
            No FAQ entries match your search criteria. Try a different term, or write to us directly from the Contact page!
          </div>
        )}
      </div>
    </div>
  );
}
