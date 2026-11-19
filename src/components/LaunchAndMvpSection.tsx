import { useState } from 'react';
import { SectionHeader } from './SectionHeader';
import { GTM_CHANNEL_ROWS, LAUNCH_PLAN_ROWS } from '../data/venturePlanData';

const formatINR = (val: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val);

export function LaunchAndMvpSection() {
  const [phaseFilter, setPhaseFilter] = useState<string>('all');

  const totalBudget = GTM_CHANNEL_ROWS.reduce((acc, r) => acc + r.budgetInr, 0);
  const totalLeads = GTM_CHANNEL_ROWS.reduce((acc, r) => acc + r.expectedLeads, 0);
  const totalCustomers = GTM_CHANNEL_ROWS.reduce((acc, r) => acc + r.expectedCustomers, 0);
  const blendedConversion = (totalCustomers / totalLeads) * 100;
  const blendedDirectCac = totalBudget / totalCustomers;

  const filteredLaunchRows =
    phaseFilter === 'all'
      ? LAUNCH_PLAN_ROWS
      : LAUNCH_PLAN_ROWS.filter((r) => r.phase === phaseFilter);

  const phases = [
    'Week 1 – Preparation',
    'Week 2 – Launch',
    'Week 3 – Measurement',
    'Week 4 – Learning & Adjustment',
  ];

  return (
    <div className="space-y-8">
      {/* SECTION 12: GO-TO-MARKET STRATEGY */}
      <section id="section-12" className="bg-white border border-zinc-200 rounded-lg p-8 sm:p-10 print-break-before">
        <SectionHeader
          number="12"
          title="Go-To-Market (GTM) Strategy"
          subtitle="High-touch, capital-efficient customer acquisition anchored in Dhiman Market (Selaqui) shop visits, merchant associations, and peer referrals."
          pageNumber="13"
        />

        {/* GTM Narrative & Messaging Box */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-7 text-sm">
          <div className="lg:col-span-5 border border-purple-200 bg-purple-50/40 rounded-md p-5 space-y-3">
            <div>
              <div className="text-xs font-semibold text-purple-900">First Customer Segment</div>
              <p className="text-zinc-700 mt-0.5">General stores, kiranas, and neighbourhood retail shops in Dhiman Market &amp; Selaqui Main Road.</p>
            </div>
            <div>
              <div className="text-xs font-semibold text-purple-900">Core Value Message</div>
              <p className="text-zinc-700 mt-0.5">“Weekly in-shop financial, inventory, and WhatsApp marketing help from vetted Dehradun MBA students—at ₹1,500–₹2,000/month, without software hassle.”</p>
            </div>
            <div>
              <div className="text-xs font-semibold text-purple-900">Primary Call to Action (CTA)</div>
              <p className="text-zinc-700 mt-0.5"><strong>Book a Free 30-Minute Profit &amp; Ledger Health Check</strong> at your shop counter this week.</p>
            </div>
          </div>

          <div className="lg:col-span-7 border border-zinc-200 rounded-md p-5 flex flex-col justify-between">
            <div>
              <h3 className="font-semibold text-zinc-900 mb-2">Customer Discovery Locations &amp; Acquisition Economics</h3>
              <p className="text-zinc-600 leading-relaxed mb-4">
                Discovery concentrates within a 5 km radius of DBS Global University: <strong>Dhiman Market (Selaqui)</strong>, Selaqui Main Market, Sudhowala Chowk, and Prem Nagar Bazaar. By aligning the ₹3,500 monthly marketing budget directly with the Fixed Operating Cost ledger (Section 9), every rupee is tracked against expected lead flow and Customer Acquisition Cost (CAC).
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-zinc-200">
              <div>
                <div className="text-xs text-zinc-500">Monthly GTM Budget</div>
                <div className="font-mono-tabular text-lg font-semibold text-zinc-900">{formatINR(totalBudget)}</div>
              </div>
              <div>
                <div className="text-xs text-zinc-500">Expected Leads</div>
                <div className="font-mono-tabular text-lg font-semibold text-zinc-900">{totalLeads}</div>
              </div>
              <div>
                <div className="text-xs text-zinc-500">Direct Spend CAC</div>
                <div className="font-mono-tabular text-lg font-semibold text-purple-800">{formatINR(Math.round(blendedDirectCac))}</div>
              </div>
              <div>
                <div className="text-xs text-zinc-500">Steady-State LTV:CAC</div>
                <div className="font-mono-tabular text-lg font-semibold text-zinc-900">16.1 : 1</div>
              </div>
            </div>
          </div>
        </div>

        {/* Channel-Wise Budget & CAC Table */}
        <div className="overflow-x-auto border border-zinc-200 rounded-md mb-4">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-[#F4F3F8] border-b border-zinc-200 text-zinc-800">
                <th className="py-3 px-3.5 font-semibold min-w-[180px]">Marketing Channel</th>
                <th className="py-3 px-3.5 font-semibold min-w-[230px]">Execution Tactic</th>
                <th className="py-3 px-3.5 font-semibold text-right">Budget</th>
                <th className="py-3 px-3.5 font-semibold text-right">Est. Leads</th>
                <th className="py-3 px-3.5 font-semibold text-right">Conv. %</th>
                <th className="py-3 px-3.5 font-semibold text-right">New Cust.</th>
                <th className="py-3 px-3.5 font-semibold text-right">Channel CAC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {GTM_CHANNEL_ROWS.map((row) => (
                <tr key={row.channel} className="hover:bg-zinc-50/70 align-top">
                  <td className="py-3 px-3.5 font-semibold text-zinc-900">{row.channel}</td>
                  <td className="py-3 px-3.5 text-zinc-600 leading-relaxed">{row.tactic}</td>
                  <td className="py-3 px-3.5 font-mono-tabular text-right">{formatINR(row.budgetInr)}</td>
                  <td className="py-3 px-3.5 font-mono-tabular text-right">{row.expectedLeads}</td>
                  <td className="py-3 px-3.5 font-mono-tabular text-right">{row.conversionRatePct.toFixed(1)}%</td>
                  <td className="py-3 px-3.5 font-mono-tabular text-right font-semibold">{row.expectedCustomers}</td>
                  <td className="py-3 px-3.5 font-mono-tabular text-right text-purple-800 font-semibold">{formatINR(row.cacInr)}</td>
                </tr>
              ))}
              <tr className="bg-[#FAFAFC] font-semibold">
                <td className="py-3 px-3.5 text-zinc-900" colSpan={2}>
                  Total Monthly Outreach Plan (Launch Cohort Assumption)
                </td>
                <td className="py-3 px-3.5 font-mono-tabular text-right text-zinc-900">{formatINR(totalBudget)}</td>
                <td className="py-3 px-3.5 font-mono-tabular text-right text-zinc-900">{totalLeads}</td>
                <td className="py-3 px-3.5 font-mono-tabular text-right text-zinc-900">{blendedConversion.toFixed(1)}%</td>
                <td className="py-3 px-3.5 font-mono-tabular text-right text-purple-900">{totalCustomers}</td>
                <td className="py-3 px-3.5 font-mono-tabular text-right text-purple-900">{formatINR(Math.round(blendedDirectCac))}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-zinc-500">
          Note on CAC &amp; LTV: Direct channel CAC averages ₹152 across 23 launch leads converted; under a conservative steady-state acquisition pace of 10 new customers/month on ₹3,500 spend, steady-state CAC is ₹350. Against a 6-month average retention LTV contribution of ₹5,625 (6 × 1.25 units × ₹750 CM), the LTV:CAC ratio is 16.1:1. All lead conversion rates are pre-pilot assumptions requiring Week 2–3 validation.
        </p>
      </section>

      {/* SECTION 13: 30-DAY LAUNCH PLAN */}
      <section id="section-13" className="bg-white border border-zinc-200 rounded-lg p-8 sm:p-10 print-break-before">
        <SectionHeader
          number="13"
          title="30-Day Launch Plan"
          subtitle="Four-week operational execution sprint from package readiness to Dhiman Market field validation and referral activation."
          pageNumber="14"
        />

        {/* Phase Filter Bar (Interactive Control) */}
        <div className="no-print flex flex-wrap items-center gap-1.5 p-1 bg-zinc-100 rounded-md mb-6 w-fit">
          <button
            type="button"
            onClick={() => setPhaseFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              phaseFilter === 'all' ? 'bg-purple-800 text-white' : 'text-zinc-700 hover:text-zinc-900'
            }`}
          >
            All 4 Weeks
          </button>
          {phases.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPhaseFilter(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                phaseFilter === p ? 'bg-purple-800 text-white' : 'text-zinc-700 hover:text-zinc-900'
              }`}
            >
              {p.split(' – ')[0]}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto border border-zinc-200 rounded-md">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-[#F4F3F8] border-b border-zinc-200 text-zinc-800">
                <th className="py-3 px-3.5 font-semibold min-w-[140px]">Phase</th>
                <th className="py-3 px-3.5 font-semibold min-w-[210px]">Planned Action</th>
                <th className="py-3 px-3.5 font-semibold min-w-[130px]">Marketing Channel</th>
                <th className="py-3 px-3.5 font-semibold min-w-[140px]">Target</th>
                <th className="py-3 px-3.5 font-semibold min-w-[140px]">Performance Metric</th>
                <th className="py-3 px-3.5 font-semibold min-w-[130px]">Responsible Person</th>
                <th className="py-3 px-3.5 font-semibold min-w-[190px]">Learning Question</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {filteredLaunchRows.map((row, idx) => (
                <tr key={`${row.phase}-${idx}`} className="hover:bg-zinc-50/70 align-top">
                  <td className="py-3.5 px-3.5 font-semibold text-purple-900">{row.phase}</td>
                  <td className="py-3.5 px-3.5 text-zinc-700 leading-relaxed">{row.plannedAction}</td>
                  <td className="py-3.5 px-3.5 text-zinc-600">{row.marketingChannel}</td>
                  <td className="py-3.5 px-3.5 text-zinc-800 font-medium">{row.target}</td>
                  <td className="py-3.5 px-3.5 text-zinc-600">{row.performanceMetric}</td>
                  <td className="py-3.5 px-3.5 text-zinc-700">{row.responsiblePerson}</td>
                  <td className="py-3.5 px-3.5 text-zinc-600 italic leading-relaxed">{row.learningQuestion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 14: MVP SCOPE */}
      <section id="section-14" className="bg-white border border-zinc-200 rounded-lg p-8 sm:p-10 print-break-before">
        <SectionHeader
          number="14"
          title="Minimum Viable Product (MVP) Scope"
          subtitle="Service-first validation using standardised Excel & WhatsApp workflows—deferring custom software engineering until demand is proven."
          pageNumber="15"
        />

        {/* Core MVP Framing */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-7 text-sm">
          <div className="border border-purple-200 bg-purple-50/50 rounded-md p-4">
            <div className="text-xs font-semibold text-purple-900 mb-1">Single Most Important Assumption</div>
            <p className="text-zinc-800 leading-relaxed">
              Local shop owners in Dhiman Market will trust student consultants with store records and pay ≥ ₹1,500/unit for weekly Excel bookkeeping &amp; inventory support.
            </p>
          </div>
          <div className="border border-zinc-200 rounded-md p-4">
            <div className="text-xs font-semibold text-purple-800 mb-1">MVP Purpose</div>
            <p className="text-zinc-600 leading-relaxed">
              Validate paid demand, unit delivery time (&lt;4 hrs/month/client), and Month-2 retention in 30 days with near-zero technology capital expenditure.
            </p>
          </div>
          <div className="border border-zinc-200 rounded-md p-4">
            <div className="text-xs font-semibold text-purple-800 mb-1">Target Core User</div>
            <p className="text-zinc-600 leading-relaxed">
              Independent general store and small retail proprietors in Dhiman Market (Selaqui) currently relying on paper Bahi-Khata.
            </p>
          </div>
          <div className="border border-zinc-200 rounded-md p-4">
            <div className="text-xs font-semibold text-purple-800 mb-1">Core Problem Addressed</div>
            <p className="text-zinc-600 leading-relaxed">
              Lack of structured daily sales, <em>udhaar</em> credit, supplier payable, and monthly net-profit visibility.
            </p>
          </div>
        </div>

        {/* MoSCoW Prioritisation Matrix */}
        <h3 className="text-base font-semibold text-zinc-900 mb-3">
          Feature Prioritisation — MoSCoW Matrix (Version 1 Concierge MVP)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-7 text-sm">
          <div className="border border-zinc-200 rounded-md p-5">
            <div className="text-xs font-semibold text-purple-900 mb-2">M — Must-Have Features (Core V1)</div>
            <ul className="space-y-1.5 text-zinc-700 list-disc pl-4 leading-relaxed">
              <li>Standardised Excel Bookkeeping &amp; Profit-Loss Template (Hindi/English labels).</li>
              <li>Digital Customer Credit (<em>Udhaar</em>) &amp; Supplier Payable Aging Sheet.</li>
              <li>Weekly 30–45 minute on-site student counter visit &amp; bill photo capture.</li>
              <li>1-page Sunday WhatsApp PDF financial summary for the shop owner.</li>
              <li>Signed Student Confidentiality Pledge &amp; DBS Global University ID verification.</li>
            </ul>
          </div>

          <div className="border border-zinc-200 rounded-md p-5">
            <div className="text-xs font-semibold text-purple-800 mb-2">S — Should-Have Features</div>
            <ul className="space-y-1.5 text-zinc-700 list-disc pl-4 leading-relaxed">
              <li>Top-250 SKU Inventory Reorder &amp; Near-Expiry Alert Excel sheet.</li>
              <li>Google Business Profile setup &amp; storefront map verification.</li>
              <li>4–6 festival/promotional WhatsApp status offer templates via Canva.</li>
              <li>Standardised internal QA checklist reviewed by Venture Lead before delivery.</li>
            </ul>
          </div>

          <div className="border border-zinc-200 rounded-md p-5 bg-[#FAFAFC]">
            <div className="text-xs font-semibold text-zinc-700 mb-2">C — Could-Have Features</div>
            <ul className="space-y-1.5 text-zinc-600 list-disc pl-4 leading-relaxed">
              <li>Basic GST summary export sheet formatted for annual CA filing handoff.</li>
              <li>Monthly Instagram reel / local ad boost package (₹1,200 add-on).</li>
              <li>Simple Google Form client satisfaction &amp; referral intake link.</li>
            </ul>
          </div>

          <div className="border border-zinc-200 rounded-md p-5 bg-[#FAFAFC]">
            <div className="text-xs font-semibold text-rose-800 mb-2">W — Won’t-Have Features (Excluded from Version 1)</div>
            <ul className="space-y-1.5 text-zinc-600 list-disc pl-4 leading-relaxed">
              <li>Custom Android/iOS mobile app or proprietary POS billing software.</li>
              <li>Automated barcode hardware integration or ERP warehouse syncing.</li>
              <li>Statutory CA audit sign-off or regulated tax-filing advisory.</li>
              <li>Two-sided automated online marketplace with algorithmic matching.</li>
            </ul>
          </div>
        </div>

        {/* MVP Success Metrics */}
        <div className="border border-zinc-200 rounded-md p-5 bg-[#FAFAFC]">
          <h4 className="text-sm font-semibold text-zinc-900 mb-2">Version 1 MVP Success Metrics (30-Day Gate)</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs sm:text-sm">
            <div>
              <div className="text-zinc-500">Paid Conversion</div>
              <div className="font-mono-tabular font-semibold text-zinc-900 mt-0.5">≥ 6 Paying Clients</div>
            </div>
            <div>
              <div className="text-zinc-500">Delivery Turnaround</div>
              <div className="font-mono-tabular font-semibold text-zinc-900 mt-0.5">≤ 72 Hours / Setup</div>
            </div>
            <div>
              <div className="text-zinc-500">Client Satisfaction</div>
              <div className="font-mono-tabular font-semibold text-zinc-900 mt-0.5">≥ 4.2 / 5.0 Rating</div>
            </div>
            <div>
              <div className="text-zinc-500">Month-2 Renewal</div>
              <div className="font-mono-tabular font-semibold text-purple-900 mt-0.5">≥ 70% Retained</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
