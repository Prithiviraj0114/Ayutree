import { Sparkle, Truck, ShieldCheck, ArrowClockwise, CurrencyInr } from "@phosphor-icons/react";

export default function ShippingReturns() {
  return (
    <div data-testid="shipping-returns-page" className="min-h-[80vh] bg-[#F9F6F0] py-16 px-6 md:px-12 lg:px-20">
      <div className="max-w-4xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 border border-[#C2A878] text-[#C2A878] mb-4">
            <Sparkle size={12} weight="fill" />
            <span className="text-[10px] uppercase tracking-[0.25em]">Polices & Info</span>
          </div>
          <h1 className="font-serif-display text-4xl md:text-5xl text-[#12221C] font-light">Shipping &amp; Returns</h1>
          <p className="mt-4 text-sm text-[#5C6B64] leading-relaxed">
            Transparent delivery timelines and easy return policies to give you a hassle-free Ayurvedic ritual shopping experience.
          </p>
        </div>

        {/* Highlight Cards Grid */}
        <div className="grid sm:grid-cols-3 gap-6 mb-16">
          <div className="bg-white border border-[#E8E1D5] p-6 text-center rounded-lg shadow-sm">
            <div className="w-12 h-12 rounded-full bg-[#1A3B32]/5 flex items-center justify-center text-[#1A3B32] mx-auto mb-4">
              <Truck size={24} weight="light" />
            </div>
            <h3 className="font-serif-display text-lg text-[#12221C]">Free Shipping</h3>
            <p className="text-xs text-[#5C6B64] mt-2 font-light">On all orders above ₹499 within India.</p>
          </div>

          <div className="bg-white border border-[#E8E1D5] p-6 text-center rounded-lg shadow-sm">
            <div className="w-12 h-12 rounded-full bg-[#1A3B32]/5 flex items-center justify-center text-[#1A3B32] mx-auto mb-4">
              <ArrowClockwise size={24} weight="light" />
            </div>
            <h3 className="font-serif-display text-lg text-[#12221C]">7-Day Returns</h3>
            <p className="text-xs text-[#5C6B64] mt-2 font-light">Easy exchanges or refunds for unused/damaged items.</p>
          </div>

          <div className="bg-white border border-[#E8E1D5] p-6 text-center rounded-lg shadow-sm">
            <div className="w-12 h-12 rounded-full bg-[#1A3B32]/5 flex items-center justify-center text-[#1A3B32] mx-auto mb-4">
              <CurrencyInr size={24} weight="light" />
            </div>
            <h3 className="font-serif-display text-lg text-[#12221C]">COD Available</h3>
            <p className="text-xs text-[#5C6B64] mt-2 font-light">Cash on Delivery option at zero extra cost.</p>
          </div>
        </div>

        {/* Detailed Sections */}
        <div className="space-y-12 bg-white border border-[#E8E1D5] p-8 md:p-12 rounded-lg shadow-sm">
          {/* Shipping Policy */}
          <section>
            <h2 className="font-serif-display text-2xl text-[#12221C] border-b border-[#E8E1D5] pb-3 mb-4 flex items-center gap-2">
              <span className="text-[#C2A878] text-xl">01/</span> Shipping Policy
            </h2>
            <div className="space-y-4 text-sm text-[#5C6B64] leading-relaxed font-light">
              <p>
                Every order placed at Ayutree is handcrafted, prepared in small batches, and dispatched with fresh ingredients from our apothecary in Erode, Tamil Nadu.
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Dispatch Window:</strong> All orders are dispatched within 24 to 48 business hours of order placement.</li>
                <li><strong>Delivery Timeline:</strong> Domestic shipping within India takes between <strong>3 to 7 business days</strong> depending on your location and pincode serviceability.</li>
                <li><strong>Courier Partners:</strong> We work with premier courier services (like BlueDart, Delhivery, DTDC, and Speed Post) to ensure safe and prompt delivery of your items.</li>
                <li><strong>Tracking:</strong> Once your package is handed over to the courier, we will email and SMS you a tracking number to follow its journey.</li>
              </ul>
            </div>
          </section>

          {/* Returns & Replacements */}
          <section>
            <h2 className="font-serif-display text-2xl text-[#12221C] border-b border-[#E8E1D5] pb-3 mb-4 flex items-center gap-2">
              <span className="text-[#C2A878] text-xl">02/</span> Returns &amp; Replacements
            </h2>
            <div className="space-y-4 text-sm text-[#5C6B64] leading-relaxed font-light">
              <p>
                We take immense pride in our quality control and formulation care. However, if you receive a product that is leaked, damaged during transit, or incorrect, we offer a <strong>7-day replacement/refund guarantee</strong>.
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>To initiate a return, write to us at <strong>prithiviraj0114@gmail.com</strong> or WhatsApp our support at <strong>+91 9791975741</strong> with your Order ID and photos of the package.</li>
                <li>Due to the hygiene-sensitive nature of personal care products, we cannot accept returns for products that have been opened or used unless they were delivered in a damaged state.</li>
              </ul>
            </div>
          </section>

          {/* Cancellation Policy */}
          <section>
            <h2 className="font-serif-display text-2xl text-[#12221C] border-b border-[#E8E1D5] pb-3 mb-4 flex items-center gap-2">
              <span className="text-[#C2A878] text-xl">03/</span> Cancellation Policy
            </h2>
            <p className="text-sm text-[#5C6B64] leading-relaxed font-light">
              You can cancel your order at any time before it has been dispatched from our facility. Please write to us or message us on WhatsApp with your Order ID immediately. Once dispatched, orders cannot be cancelled in transit, but you can choose to refuse the delivery or contact us for return authorization.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
