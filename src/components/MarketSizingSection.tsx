import { SectionHeader } from './SectionHeader';

export function MarketSizingSection() {
  return (
    <section id="section-11" className="bg-white border border-zinc-200 rounded-lg p-8 sm:p-10 print-break-before">
      <SectionHeader
        number="11"
        title="Market Size — TAM / SAM / SOM"
        subtitle="Top-down and bottom-up market sizing in INR, explicitly separating verified MSME/Census benchmarks from estimated penetration assumptions."
        pageNumber="12"
      />

      {/* Concentric Market Diagram + Top Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center mb-8">
        <div className="lg:col-span-5 flex justify-center bg-[#FAFAFC] border border-zinc-200 rounded-md p-6">
          <svg
            viewBox="0 0 360 320"
            className="w-full max-w-[330px] h-auto"
            role="img"
            aria-label="Concentric TAM SAM SOM market opportunity diagram"
          >
            {/* TAM */}
            <circle cx="180" cy="155" r="138" fill="#F3E8FF" stroke="#7E22CE" strokeWidth="1.5" />
            <text x="180" y="45" textAnchor="middle" fontSize="11" fontWeight="700" fill="#581C87">
              TAM · ₹32,400 Crore / yr
            </text>
            <text x="180" y="61" textAnchor="middle" fontSize="10" fill="#6B21A8">
              1.20 Cr Urban/Semi-Urban Micro-Retailers (India)
            </text>

            {/* SAM */}
            <circle cx="180" cy="185" r="95" fill="#DDD6FE" stroke="#6D28D9" strokeWidth="1.5" />
            <text x="180" y="116" textAnchor="middle" fontSize="11" fontWeight="700" fill="#4C1D95">
              SAM · ₹48.60 Crore / yr
            </text>
            <text x="180" y="131" textAnchor="middle" fontSize="10" fill="#5B21B6">
              18,000 Dehradun Small Businesses
            </text>

            {/* SOM */}
            <circle cx="180" cy="222" r="52" fill="#5B21B6" />
            <text x="180" y="213" textAnchor="middle" fontSize="11" fontWeight="700" fill="#FFFFFF">
              SOM · ₹8.10 Lakh
            </text>
            <text x="180" y="229" textAnchor="middle" fontSize="9.5" fill="#EDE9FE">
              30 Active Clients (Yr 1)
            </text>
            <text x="180" y="243" textAnchor="middle" fontSize="9" fill="#DDD6FE">
              0.17% of SAM
            </text>
          </svg>
        </div>

        <div className="lg:col-span-7 space-y-4">
          <div className="border border-zinc-200 rounded-md p-5">
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="font-semibold text-zinc-900">TAM — Total Addressable Market (India Micro-Retail)</h3>
              <span className="font-mono-tabular text-sm font-semibold text-purple-900">₹32,400 Cr / yr</span>
            </div>
            <p className="text-sm text-zinc-600 mt-1.5 leading-relaxed">
              <strong>1,20,00,000 (1.20 Crore)</strong> urban and semi-urban small retail &amp; neighbourhood service businesses across India × <strong>₹27,000/year</strong> average annualised spend (1.25 units/month × ₹1,800 × 12). Grounded in the Ministry of MSME Annual Report (~6.33 Cr total unincorporated non-agricultural MSMEs, of which ~2.3 Cr are in retail/wholesale trade; ~52% estimated addressable in smartphone-connected towns).
            </p>
          </div>

          <div className="border border-zinc-200 rounded-md p-5">
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="font-semibold text-zinc-900">SAM — Serviceable Available Market (Dehradun District)</h3>
              <span className="font-mono-tabular text-sm font-semibold text-purple-900">₹48.60 Cr / yr</span>
            </div>
            <p className="text-sm text-zinc-600 mt-1.5 leading-relaxed">
              <strong>18,000</strong> active neighbourhood general stores, mini-marts, pharmacies, and local service outlets in Dehradun urban, Selaqui, Prem Nagar, and Rajpur corridors × <strong>₹27,000/year</strong>. Derived from Census 2011 district population base (16.96 lakh; ~18 lakh estimated current catchment ÷ ~100 residents per retail outlet benchmark).
            </p>
          </div>

          <div className="border border-purple-200 bg-purple-50/50 rounded-md p-5">
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="font-semibold text-purple-950">SOM — Serviceable Obtainable Market (Year 1 Realistic Capture)</h3>
              <span className="font-mono-tabular text-sm font-semibold text-purple-900">₹8.10 Lakh / yr</span>
            </div>
            <p className="text-sm text-zinc-700 mt-1.5 leading-relaxed">
              <strong>30 average active paying businesses</strong> across Year 1 (ramping from 10 in Q1 to 36+ by Q4 within the ~1,200-shop Selaqui / Dhiman Market / Prem Nagar immediate catchment) × <strong>₹27,000/year</strong> = <strong>₹8,10,000</strong>. Represents a realistic <strong>0.17% penetration of SAM</strong> (or 2.5% of the immediate 1,200-shop Selaqui corridor).
            </p>
          </div>
        </div>
      </div>

      {/* Verified vs Estimated Transparency Table */}
      <h3 className="text-base font-semibold text-zinc-900 mb-3">
        Market Sizing Methodology &amp; Evidence Classification
      </h3>
      <div className="overflow-x-auto border border-zinc-200 rounded-md">
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="bg-[#F4F3F8] border-b border-zinc-200 text-zinc-800">
              <th className="py-3 px-4 font-semibold">Tier</th>
              <th className="py-3 px-4 font-semibold text-right">Customer Count</th>
              <th className="py-3 px-4 font-semibold text-right">Annual Value (INR)</th>
              <th className="py-3 px-4 font-semibold text-right">Penetration</th>
              <th className="py-3 px-4 font-semibold">Verified Basis vs. Estimation Assumptions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            <tr className="align-top">
              <td className="py-3 px-4 font-semibold text-zinc-900">TAM</td>
              <td className="py-3 px-4 font-mono-tabular text-right">1,20,00,000</td>
              <td className="py-3 px-4 font-mono-tabular text-right">₹32,400 Crore</td>
              <td className="py-3 px-4 font-mono-tabular text-right">100% Scope</td>
              <td className="py-3 px-4 text-zinc-600 leading-relaxed">
                <strong>Verified:</strong> 6.33 Cr Indian MSMEs (Ministry of MSME / NSS 73rd Round). <strong>Estimated:</strong> 1.20 Cr urban/semi-urban retail subset × ₹27,000/yr spend potential.
              </td>
            </tr>
            <tr className="align-top">
              <td className="py-3 px-4 font-semibold text-zinc-900">SAM</td>
              <td className="py-3 px-4 font-mono-tabular text-right">18,000</td>
              <td className="py-3 px-4 font-mono-tabular text-right">₹48.60 Crore</td>
              <td className="py-3 px-4 font-mono-tabular text-right">0.15% of TAM</td>
              <td className="py-3 px-4 text-zinc-600 leading-relaxed">
                <strong>Verified:</strong> 16.96 lakh Dehradun District population (Census 2011). <strong>Estimated:</strong> ~100 residents per retail outlet ratio yielding ~18,000 target shops within 20 km service radius.
              </td>
            </tr>
            <tr className="bg-purple-50/40 align-top">
              <td className="py-3 px-4 font-semibold text-purple-900">SOM (Yr 1)</td>
              <td className="py-3 px-4 font-mono-tabular text-right font-semibold text-purple-900">30</td>
              <td className="py-3 px-4 font-mono-tabular text-right font-semibold text-purple-900">₹8,10,000</td>
              <td className="py-3 px-4 font-mono-tabular text-right font-semibold text-purple-900">0.17% of SAM</td>
              <td className="py-3 px-4 text-zinc-700 leading-relaxed">
                <strong>Estimated Hypothesis:</strong> Bottom-up student team capacity (6–10 consultants managing 3–4 retainers each) within Dhiman Market &amp; Selaqui (~1,200 immediate shops; requires street-level tally).
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
