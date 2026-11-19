import { useState } from 'react';
import { SectionHeader } from './SectionHeader';
import { COMPETITOR_ROWS } from '../data/venturePlanData';

export function CompetitivePositioningSection() {
  const [selectedIdx, setSelectedIdx] = useState<number>(5); // Default focus on Campus Consult Dehradun
  const selected = COMPETITOR_ROWS[selectedIdx];

  return (
    <div className="space-y-8">
      {/* SECTION 07: COMPETITION ANALYSIS */}
      <section id="section-7" className="bg-white border border-zinc-200 rounded-lg p-8 sm:p-10 print-break-before">
        <SectionHeader
          number="07"
          title="Competition Analysis"
          subtitle="Benchmarking traditional workarounds, professional firms, SaaS tools, and freelancers across cost, service delivery, and reliability of evidence."
          pageNumber="07"
        />

        <div className="overflow-x-auto border border-zinc-200 rounded-md mb-8">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-[#F4F3F8] border-b border-zinc-200 text-zinc-800">
                <th className="py-3 px-3.5 font-semibold min-w-[170px]">Competitor / Alternative</th>
                <th className="py-3 px-3.5 font-semibold min-w-[130px]">Type</th>
                <th className="py-3 px-3.5 font-semibold min-w-[150px]">Price / Cost</th>
                <th className="py-3 px-3.5 font-semibold min-w-[160px]">Main Offering</th>
                <th className="py-3 px-3.5 font-semibold min-w-[150px]">Strengths</th>
                <th className="py-3 px-3.5 font-semibold min-w-[170px]">Weaknesses</th>
                <th className="py-3 px-3.5 font-semibold min-w-[160px]">Evidence &amp; Reliability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {COMPETITOR_ROWS.map((row, idx) => {
                const isVenture = idx === 5;
                return (
                  <tr
                    key={row.alternative}
                    onClick={() => setSelectedIdx(idx)}
                    className={`cursor-pointer transition-colors align-top ${
                      isVenture
                        ? 'bg-purple-50/70 hover:bg-purple-50'
                        : selectedIdx === idx
                        ? 'bg-zinc-50'
                        : 'hover:bg-zinc-50/70'
                    }`}
                  >
                    <td className={`py-3.5 px-3.5 font-semibold ${isVenture ? 'text-purple-900' : 'text-zinc-900'}`}>
                      {row.alternative}
                    </td>
                    <td className="py-3.5 px-3.5 text-zinc-600">{row.type}</td>
                    <td className="py-3.5 px-3.5 font-mono-tabular text-zinc-800">{row.priceCost}</td>
                    <td className="py-3.5 px-3.5 text-zinc-600 leading-relaxed">{row.mainOffering}</td>
                    <td className="py-3.5 px-3.5 text-zinc-600 leading-relaxed">{row.strengths}</td>
                    <td className="py-3.5 px-3.5 text-zinc-600 leading-relaxed">{row.weaknesses}</td>
                    <td className="py-3.5 px-3.5 text-zinc-600 leading-relaxed">{row.evidenceReliability}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 2x2 Competitive Positioning Map */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 border border-zinc-200 rounded-md p-5 bg-[#FAFAFC]">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-semibold text-zinc-900">
                Competitive Positioning Map: Financial Cost vs. Service Delivery
              </h3>
              <span className="text-xs text-zinc-500">Click any plotted point to inspect</span>
            </div>

            <svg
              viewBox="0 0 560 360"
              className="w-full h-auto bg-white border border-zinc-200 rounded"
              role="img"
              aria-label="2 by 2 competitive positioning matrix plotting cost against dedicated on-site support"
            >
              {/* Quadrant Shading: Top-Left Sweet Spot */}
              <rect x="60" y="30" width="220" height="145" fill="#F5F3FF" />
              <text x="72" y="50" fontSize="10" fontWeight="600" fill="#5B21B6">
                TARGET WHITESPACE: Low Cost + Dedicated On-Site Support
              </text>

              {/* Grid Axes */}
              <line x1="280" y1="30" x2="280" y2="320" stroke="#D4D4D8" strokeDasharray="4 4" strokeWidth="1.5" />
              <line x1="60" y1="175" x2="520" y2="175" stroke="#D4D4D8" strokeDasharray="4 4" strokeWidth="1.5" />

              {/* Border Frame */}
              <rect x="60" y="30" width="460" height="290" fill="none" stroke="#E4E4E7" strokeWidth="1" />

              {/* Axis Labels */}
              <text x="65" y="340" fontSize="11" fontWeight="600" fill="#52525B">← Low Financial Cost</text>
              <text x="415" y="340" fontSize="11" fontWeight="600" fill="#52525B">High Financial Cost →</text>

              <text x="18" y="180" fontSize="11" fontWeight="600" fill="#52525B" transform="rotate(-90 18 180)" textAnchor="middle">
                Self-Service  ←  Service Delivery  →  Dedicated On-Site
              </text>

              {/* Plot Points */}
              {COMPETITOR_ROWS.map((item, idx) => {
                // x: costScore 0..100 mapped to 70..500
                const cx = 70 + (item.quadrant.costScore / 100) * 430;
                // y: supportScore 100 (On-site top) -> 45, 0 (Self-service bottom) -> 305
                const cy = 305 - (item.quadrant.supportScore / 100) * 255;
                const isVenture = idx === 5;
                const isSelected = selectedIdx === idx;

                return (
                  <g
                    key={item.alternative}
                    onClick={() => setSelectedIdx(idx)}
                    className="cursor-pointer"
                  >
                    {isSelected && (
                      <circle cx={cx} cy={cy} r={isVenture ? 16 : 13} fill="none" stroke="#6D28D9" strokeWidth="2" opacity="0.5" />
                    )}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isVenture ? 9 : 6.5}
                      fill={isVenture ? '#5B21B6' : '#52525B'}
                      stroke="#FFFFFF"
                      strokeWidth="2"
                    />
                    <text
                      x={cx + (cx > 390 ? -12 : 12)}
                      y={cy + 4}
                      fontSize={isVenture ? '11.5' : '10.5'}
                      fontWeight={isVenture ? '700' : '500'}
                      fill={isVenture ? '#4C1D95' : '#27272A'}
                      textAnchor={cx > 390 ? 'end' : 'start'}
                    >
                      {item.quadrant.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="lg:col-span-5 space-y-5">
            <div className="border border-zinc-200 rounded-md p-5">
              <div className="text-xs font-semibold text-purple-800 mb-1">Selected Alternative Profile</div>
              <h4 className="font-display text-lg font-semibold text-zinc-900">{selected.alternative}</h4>
              <div className="text-xs text-zinc-500 mt-0.5 mb-3">{selected.type} · {selected.priceCost}</div>
              <div className="space-y-2 text-sm text-zinc-700 leading-relaxed">
                <p><strong>Strengths:</strong> {selected.strengths}</p>
                <p><strong>Weaknesses:</strong> {selected.weaknesses}</p>
                <p className="text-xs text-zinc-500 pt-2 border-t border-zinc-100">
                  <strong>Evidence Status:</strong> {selected.evidenceReliability}
                </p>
              </div>
            </div>

            <div className="bg-[#FAFAFC] border border-zinc-200 rounded-md p-5 text-sm">
              <h4 className="font-semibold text-zinc-900 mb-1.5">How Campus Consult Differentiates</h4>
              <p className="text-zinc-600 leading-relaxed">
                No existing player occupies the <strong>Low-Cost + Dedicated On-Site Support</strong> quadrant. Software apps are cheap but fail due to self-service fatigue; CAs and agencies offer human expertise but price out micro-retailers. Campus Consult uses part-time university student talent—whose primary non-monetary incentive is practical MBA/BBA experience—to deliver human-assisted Excel and marketing execution at software-adjacent prices.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 08: POSITIONING */}
      <section id="section-8" className="bg-white border border-zinc-200 rounded-lg p-8 sm:p-10 print-break-before print-avoid-break">
        <SectionHeader
          number="08"
          title="Market Positioning Strategy"
          subtitle="Defining a defensible category claim that separates Campus Consult from software apps and traditional CA firms."
          pageNumber="08"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-7 text-sm">
          <div className="border border-zinc-200 rounded-md p-4">
            <div className="text-xs font-semibold text-purple-800 mb-1">Target Customer</div>
            <p className="text-zinc-700">General store owners and small retail operators in Dhiman Market (Selaqui) and neighbourhood markets of Dehradun.</p>
          </div>
          <div className="border border-zinc-200 rounded-md p-4">
            <div className="text-xs font-semibold text-purple-800 mb-1">Category Claim</div>
            <p className="text-zinc-700">Student-led hyper-local micro-consulting &amp; business support service.</p>
          </div>
          <div className="border border-zinc-200 rounded-md p-4">
            <div className="text-xs font-semibold text-purple-800 mb-1">Primary Customer Benefit</div>
            <p className="text-zinc-700">Weekly on-site financial, inventory, and digital clarity without software complexity or high fees.</p>
          </div>
          <div className="border border-zinc-200 rounded-md p-4">
            <div className="text-xs font-semibold text-purple-800 mb-1">Main Alternative</div>
            <p className="text-zinc-700">Manual paper <em>Bahi-Khata</em>, abandoned self-serve ledger apps, or expensive local CA/agency retainers.</p>
          </div>
          <div className="border border-zinc-200 rounded-md p-4">
            <div className="text-xs font-semibold text-purple-800 mb-1">Key Differentiation Point</div>
            <p className="text-zinc-700">Dedicated weekly counter-side student execution paired with standardised Excel MIS at ₹1,200–₹2,000/month.</p>
          </div>
          <div className="border border-zinc-200 rounded-md p-4">
            <div className="text-xs font-semibold text-purple-800 mb-1">Reason to Believe</div>
            <p className="text-zinc-700">Vetted DBS Global University commerce/MBA teams operating under standardised templates and free 30-minute shop diagnostics.</p>
          </div>
        </div>

        <div className="bg-[#F4F3F8] border border-purple-200 rounded-md p-6 sm:p-7">
          <div className="text-xs font-semibold tracking-wider text-purple-900 mb-2">
            Final Positioning Statement
          </div>
          <p className="font-display text-lg sm:text-xl text-zinc-900 leading-relaxed">
            “For neighbourhood retail shopkeepers and small businesses in Dehradun who are dissatisfied with error-prone paper Bahi-Khata and priced out of commercial accounting and marketing agencies, <strong>Campus Consult Dehradun</strong> is an affordable, student-led micro-consulting platform that provides personalised weekly on-site bookkeeping, Excel financial reporting, inventory control, and local digital marketing—backed by vetted DBS Global University student consultants who do the setup and heavy lifting right at your shop counter.”
          </p>
        </div>
      </section>
    </div>
  );
}
