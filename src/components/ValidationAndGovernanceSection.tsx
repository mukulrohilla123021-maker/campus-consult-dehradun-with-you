import { SectionHeader } from './SectionHeader';
import { EVIDENCE_REVIEW_ROWS, KEY_ASSUMPTIONS_ROWS } from '../data/venturePlanData';

export function ValidationAndGovernanceSection() {
  const totalClaims = EVIDENCE_REVIEW_ROWS.reduce((sum, r) => sum + r.claimCount, 0);

  return (
    <div className="space-y-8">
      {/* SECTION 15: EVIDENCE REVIEW */}
      <section id="section-15" className="bg-white border border-zinc-200 rounded-lg p-8 sm:p-10 print-break-before">
        <SectionHeader
          number="15"
          title="Evidence Review & Epistemic Audit"
          subtitle="Objective classification of all strategic claims—explicitly separating verified secondary benchmarks from untested startup hypotheses."
          pageNumber="16"
        />

        {/* Proportional Evidence Distribution Bar */}
        <div className="border border-zinc-200 rounded-md p-5 bg-[#FAFAFC] mb-7">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <h3 className="text-sm font-semibold text-zinc-900">
              Evidence Reliability Mix Across {totalClaims} Core Venture Claims
            </h3>
            <span className="text-xs text-zinc-500">Zero fabricated surveys or hypothetical primary findings</span>
          </div>
          <div className="w-full h-3.5 rounded overflow-hidden flex border border-zinc-200 bg-white">
            <div
              className="bg-emerald-600 h-full"
              style={{ width: `${(4 / totalClaims) * 100}%` }}
              title="Green – Strong Evidence: 4 claims (23.5%)"
            />
            <div
              className="bg-amber-500 h-full"
              style={{ width: `${(6 / totalClaims) * 100}%` }}
              title="Amber – Moderate Evidence: 6 claims (35.3%)"
            />
            <div
              className="bg-rose-600 h-full"
              style={{ width: `${(7 / totalClaims) * 100}%` }}
              title="Red – Unvalidated Assumptions: 7 claims (41.2%)"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3 text-xs">
            <div className="flex items-center justify-between text-zinc-700">
              <span className="font-semibold text-emerald-800">Green – Strong Evidence</span>
              <span className="font-mono-tabular">4 claims (23.5%)</span>
            </div>
            <div className="flex items-center justify-between text-zinc-700">
              <span className="font-semibold text-amber-800">Amber – Moderate Evidence</span>
              <span className="font-mono-tabular">6 claims (35.3%)</span>
            </div>
            <div className="flex items-center justify-between text-zinc-700">
              <span className="font-semibold text-rose-800">Red – Unvalidated Assumptions</span>
              <span className="font-mono-tabular">7 claims (41.2%)</span>
            </div>
          </div>
        </div>

        {/* Evidence Table */}
        <div className="overflow-x-auto border border-zinc-200 rounded-md">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-[#F4F3F8] border-b border-zinc-200 text-zinc-800">
                <th className="py-3 px-3.5 font-semibold min-w-[160px]">Evidence Category</th>
                <th className="py-3 px-3.5 font-semibold text-right w-20">Claims</th>
                <th className="py-3 px-3.5 font-semibold min-w-[180px]">Methodological Status</th>
                <th className="py-3 px-3.5 font-semibold min-w-[210px]">Supporting Research</th>
                <th className="py-3 px-3.5 font-semibold min-w-[210px]">Further Validation Required</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {EVIDENCE_REVIEW_ROWS.map((row) => {
                const statusColor = row.category.startsWith('Green')
                  ? 'text-emerald-800'
                  : row.category.startsWith('Amber')
                  ? 'text-amber-800'
                  : 'text-rose-800';
                return (
                  <tr key={row.category} className="hover:bg-zinc-50/70 align-top">
                    <td className={`py-3.5 px-3.5 font-semibold ${statusColor}`}>
                      {row.category}
                    </td>
                    <td className="py-3.5 px-3.5 font-mono-tabular text-right font-semibold text-zinc-900">
                      {row.claimCount}
                    </td>
                    <td className="py-3.5 px-3.5 text-zinc-800">
                      <div className="font-medium">{row.methodologicalStatus}</div>
                      <p className="text-xs text-zinc-600 mt-1 leading-relaxed">{row.claimsSummary}</p>
                    </td>
                    <td className="py-3.5 px-3.5 text-zinc-600 leading-relaxed">{row.supportingResearch}</td>
                    <td className="py-3.5 px-3.5 text-zinc-700 leading-relaxed">{row.furtherValidationRequired}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 16: KEY ASSUMPTIONS */}
      <section id="section-16" className="bg-white border border-zinc-200 rounded-lg p-8 sm:p-10 print-break-before">
        <SectionHeader
          number="16"
          title="Key Assumptions & Risk Prioritisation"
          subtitle="Ranked risk ledger detailing the seven critical operational and commercial hypotheses governing venture survival."
          pageNumber="17"
        />

        <div className="overflow-x-auto border border-zinc-200 rounded-md">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-[#F4F3F8] border-b border-zinc-200 text-zinc-800">
                <th className="py-3 px-3 font-semibold w-14">Rank</th>
                <th className="py-3 px-3 font-semibold min-w-[170px]">Core Assumption</th>
                <th className="py-3 px-3 font-semibold min-w-[160px]">Why It Matters</th>
                <th className="py-3 px-3 font-semibold min-w-[170px]">How to Test</th>
                <th className="py-3 px-3 font-semibold min-w-[150px]">Evidence Required</th>
                <th className="py-3 px-3 font-semibold min-w-[150px]">Success Criteria</th>
                <th className="py-3 px-3 font-semibold min-w-[150px]">Potential Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {KEY_ASSUMPTIONS_ROWS.map((row) => (
                <tr key={row.priority} className="hover:bg-zinc-50/70 align-top">
                  <td className="py-3.5 px-3 font-mono-tabular font-semibold text-purple-800">
                    P{row.priority}
                  </td>
                  <td className="py-3.5 px-3 font-semibold text-zinc-900">{row.assumption}</td>
                  <td className="py-3.5 px-3 text-zinc-600 leading-relaxed">{row.whyItMatters}</td>
                  <td className="py-3.5 px-3 text-zinc-600 leading-relaxed">{row.howToTest}</td>
                  <td className="py-3.5 px-3 text-zinc-600 leading-relaxed">{row.evidenceRequired}</td>
                  <td className="py-3.5 px-3 text-zinc-800 font-medium leading-relaxed">{row.successCriteria}</td>
                  <td className="py-3.5 px-3 text-rose-800 leading-relaxed">{row.potentialRisk}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 17: NEXT VALIDATION ACTIONS */}
      <section id="section-17" className="bg-white border border-zinc-200 rounded-lg p-8 sm:p-10 print-break-before">
        <SectionHeader
          number="17"
          title="Next Validation Actions & Assignment 2 Transition"
          subtitle="Structured primary field-validation protocol connecting the Assignment 1 Strategic Blueprint to live customer discovery and Assignment 2 execution."
          pageNumber="18"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-7 text-sm">
          <div className="border border-zinc-200 rounded-md p-5">
            <div className="text-xs font-semibold text-purple-800 mb-1.5">01 · Customer Interviews &amp; Market Visits</div>
            <p className="text-zinc-600 leading-relaxed">
              Conduct 25 structured face-to-face discovery interviews in Dhiman Market &amp; Selaqui Main Road using neutral problem-discovery questions (no pitching in the first 10 minutes) to verify bookkeeping pain, existing CA fees, and daily time loss.
            </p>
          </div>
          <div className="border border-zinc-200 rounded-md p-5">
            <div className="text-xs font-semibold text-purple-800 mb-1.5">02 · Willingness-to-Pay &amp; Pricing Validation</div>
            <p className="text-zinc-600 leading-relaxed">
              Test ₹1,500 one-time setup vs ₹2,000/month retainer pricing directly with invoice commitments following a 30-minute free health check; track price objections and conversion percentages by shop vertical.
            </p>
          </div>
          <div className="border border-zinc-200 rounded-md p-5">
            <div className="text-xs font-semibold text-purple-800 mb-1.5">03 · Student Recruitment &amp; Quality Assessment</div>
            <p className="text-zinc-600 leading-relaxed">
              Screen 15–20 DBS Global University MBA/BBA applicants using a 45-minute practical Excel P&amp;L and mock-shopkeeper communication rubric; certify an initial cohort of 6–8 reliable consultants with signed confidentiality pledges.
            </p>
          </div>
          <div className="border border-zinc-200 rounded-md p-5">
            <div className="text-xs font-semibold text-purple-800 mb-1.5">04 · Pilot Service Delivery &amp; Feedback</div>
            <p className="text-zinc-600 leading-relaxed">
              Execute full 4-week bookkeeping/inventory pilot for 6–8 Dhiman Market stores; log exact consultant minutes per store, variable transit cost, and post-delivery satisfaction ratings (target ≥ 4.2/5).
            </p>
          </div>
          <div className="border border-zinc-200 rounded-md p-5">
            <div className="text-xs font-semibold text-purple-800 mb-1.5">05 · Conversion Measurement &amp; Funnel Audit</div>
            <p className="text-zinc-600 leading-relaxed">
              Measure actual walk-in → diagnostic → paid customer conversion funnel against the 19.2% GTM assumption, calculating true empirical CAC and Month-2 renewal intent.
            </p>
          </div>
          <div className="border border-purple-200 bg-purple-50/40 rounded-md p-5">
            <div className="text-xs font-semibold text-purple-900 mb-1.5">06 · Expected Learning Outcomes</div>
            <p className="text-zinc-700 leading-relaxed">
              Convert all 7 Red Unvalidated Assumptions (Section 15) into empirical field evidence—identifying whether bookkeeping, inventory, or digital marketing acts as the strongest entry wedge.
            </p>
          </div>
        </div>

        {/* Assignment 2 Transition & Future Roadmap */}
        <div className="bg-[#FAFAFC] border border-zinc-200 rounded-md p-6">
          <h3 className="font-display text-lg font-semibold text-zinc-900 mb-3">
            Transition from Assignment 1 (Blueprint) to Assignment 2 (Empirical Pilot) &amp; Future Scale
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-sm text-zinc-700 leading-relaxed">
            <div>
              <div className="font-semibold text-purple-900 mb-1">Phase A: Assignment 1 Output (Current)</div>
              <p>
                Establishes the strategic architecture, unit economics (₹750 CM, 16-unit BEP), Dhiman Market beachhead thesis, and falsifiable assumption ledger ready for field testing.
              </p>
            </div>
            <div>
              <div className="font-semibold text-purple-900 mb-1">Phase B: Assignment 2 Bridge (Weeks 1–4 Field Pilot)</div>
              <p>
                Deploys the Concierge Excel + WhatsApp MVP in Dhiman Market. Assignment 2 will report empirical shopkeeper interview transcripts, real pilot invoices, unit cost actuals, and pivot/persevere refinements.
              </p>
            </div>
            <div>
              <div className="font-semibold text-purple-900 mb-1">Phase C: Future Venture Scale (Months 6–24)</div>
              <p>
                Once Dhiman Market exceeds 16 monthly units (break-even), replicate across Prem Nagar, Rajpur Road, and neighbouring Uttarakhand university towns via formal university incubation cell partnerships and lightweight client-portal automation.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
