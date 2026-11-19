import { useState } from 'react';
import { SectionHeader } from './SectionHeader';
import { CUSTOMER_FRICTION_ROWS, STUDENT_DETAILS } from '../data/venturePlanData';

export function BlueprintSectionsOneToSix() {
  const [consultingImgError, setConsultingImgError] = useState(false);

  return (
    <div className="space-y-8">
      {/* SECTION 01: STUDENT DETAILS */}
      <section id="section-1" className="bg-white border border-zinc-200 rounded-lg p-8 sm:p-10 print-break-before print-avoid-break">
        <SectionHeader
          number="01"
          title="Student & Assignment Details"
          subtitle="Academic submission dossier and institutional identification for Entrepreneurship & Innovation."
          pageNumber="01"
        />
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
          <div className="border-b border-zinc-100 pb-4">
            <dt className="text-xs font-medium text-zinc-500">Student Name</dt>
            <dd className="mt-1 text-base font-semibold text-zinc-900">{STUDENT_DETAILS.studentName}</dd>
          </div>
          <div className="border-b border-zinc-100 pb-4">
            <dt className="text-xs font-medium text-zinc-500">Roll Number</dt>
            <dd className="mt-1 font-mono-tabular text-base font-semibold text-zinc-900">{STUDENT_DETAILS.rollNumber}</dd>
          </div>
          <div className="border-b border-zinc-100 pb-4">
            <dt className="text-xs font-medium text-zinc-500">University</dt>
            <dd className="mt-1 text-base font-semibold text-zinc-900">{STUDENT_DETAILS.university}</dd>
          </div>
          <div className="border-b border-zinc-100 pb-4">
            <dt className="text-xs font-medium text-zinc-500">Venture Name</dt>
            <dd className="mt-1 text-base font-semibold text-purple-900">{STUDENT_DETAILS.ventureName}</dd>
          </div>
          <div className="border-b border-zinc-100 pb-4">
            <dt className="text-xs font-medium text-zinc-500">Assignment</dt>
            <dd className="mt-1 text-base font-semibold text-zinc-900">{STUDENT_DETAILS.assignmentTitle}</dd>
          </div>
          <div className="border-b border-zinc-100 pb-4">
            <dt className="text-xs font-medium text-zinc-500">Course Module</dt>
            <dd className="mt-1 text-base font-semibold text-zinc-900">{STUDENT_DETAILS.courseTitle}</dd>
          </div>
        </dl>
      </section>

      {/* SECTION 02: VENTURE OVERVIEW */}
      <section id="section-2" className="bg-white border border-zinc-200 rounded-lg p-8 sm:p-10 print-break-before">
        <SectionHeader
          number="02"
          title="Venture Overview"
          subtitle="Connecting trained university business students with local micro-enterprises in Dehradun through structured, affordable consulting sprints."
          pageNumber="02"
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-7 space-y-5 text-[15px] text-zinc-700 leading-relaxed">
            <div>
              <h3 className="text-base font-semibold text-zinc-900 mb-1.5">Business Idea &amp; Service Architecture</h3>
              <p>
                <strong>Campus Consult Dehradun</strong> is a hyper-local, student-led micro-consulting platform that pairs vetted undergraduate and MBA students from Dehradun campuses—anchored initially at DBS Global University—with neighbourhood small businesses. Rather than forcing micro-retailers into complex self-serve apps or expensive chartered accountancy retainers, Campus Consult delivers affordable, project-based and monthly assistance across seven practical areas: <em>financial bookkeeping, Excel-based financial reporting, inventory management support, basic accounting assistance, graphic design, social media marketing, and digital business support</em>.
              </p>
            </div>

            <div>
              <h3 className="text-base font-semibold text-zinc-900 mb-1.5">Core Problem &amp; Proposed Solution</h3>
              <p>
                Traditional small retailers operate with thin margins (typically 12%–20% gross retail spread) yet rely on handwritten <em>Bahi-Khata</em> notebooks and mental stock estimates. Commercial agencies and CA firms price monthly retainers out of reach (₹4,000–₹20,000+), while free mobile ledger apps suffer abandonment because busy shopkeepers lack time for daily data entry. Campus Consult solves this two-sided mismatch: shop owners receive dedicated weekly on-site student visits and clean Excel MIS reports for ₹1,200–₹2,000/month, while university students gain structured commercial exposure and ₹900/unit stipends.
              </p>
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col">
            <div className="relative flex-1 min-h-[220px] rounded-md overflow-hidden border border-zinc-200 bg-zinc-100">
              {!consultingImgError ? (
                <img
                  src="/src/assets/images/student_shopkeeper_consulting_1794978260387.jpg"
                  alt="University students reviewing an Excel financial ledger with a neighbourhood general store owner"
                  referrerPolicy="no-referrer"
                  onError={() => setConsultingImgError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-zinc-50">
                  <span className="font-display text-base font-semibold text-purple-900">On-Site Field Consulting</span>
                  <span className="text-xs text-zinc-500 mt-1">Weekly Student Ledger Review</span>
                </div>
              )}
            </div>
            <p className="text-xs text-zinc-500 mt-2 italic">
              Fig. 2 — Illustrative on-site micro-consulting model: student consultants translating physical shop bills into structured Excel reporting.
            </p>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-zinc-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
          <div className="bg-[#FAFAFC] border border-zinc-200 rounded-md p-5">
            <h4 className="font-semibold text-zinc-900 mb-1.5">Initial Customer Hypothesis</h4>
            <p className="text-zinc-600 leading-relaxed">
              General store and small retail operators within a 3 km radius of Selaqui (specifically Dhiman Market) generating ₹1.5L–₹8L monthly sales will pay ₹1,500–₹2,000/month for weekly in-person Excel bookkeeping and inventory clarity if zero technical onboarding effort is required from them.
            </p>
          </div>
          <div className="bg-[#FAFAFC] border border-zinc-200 rounded-md p-5">
            <h4 className="font-semibold text-zinc-900 mb-1.5">Geographical Market &amp; Rationale</h4>
            <p className="text-zinc-600 leading-relaxed">
              Starting in Selaqui–Dhiman Market before expanding across Prem Nagar, Sudhowala, Clement Town, and Rajpur Road in Dehradun. Dehradun hosts dense student cohorts across management universities alongside thousands of family-run retail shops, creating zero-relocation supply-demand proximity.
            </p>
          </div>
          <div className="bg-[#FAFAFC] border border-zinc-200 rounded-md p-5">
            <h4 className="font-semibold text-zinc-900 mb-1.5">Objectives &amp; Expansion Potential</h4>
            <p className="text-zinc-600 leading-relaxed">
              <strong>Year 1 Goal:</strong> Break even at 16 monthly units (13 customers), scale to 30 steady-state clients (₹8.10L annualised SOM), and maintain ≥70% retention. <strong>Expansion:</strong> Replicate the campus-chapter playbook across Uttarakhand hubs (Haridwar, Rishikesh, Haldwani) via university partnerships.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 03: CUSTOMER FRICTION */}
      <section id="section-3" className="bg-white border border-zinc-200 rounded-lg p-8 sm:p-10 print-break-before">
        <SectionHeader
          number="03"
          title="Customer Friction Analysis"
          subtitle="Structured evaluation of operational, financial, and marketing pain points ranked by severity for local small businesses."
          pageNumber="03"
        />

        <div className="bg-purple-50/70 border border-purple-200 rounded-md p-4 mb-6 text-sm text-zinc-800">
          <span className="font-semibold text-purple-900">Primary Prioritised Friction (#1):</span>{' '}
          Inability to maintain structured daily financial records and true net-profit visibility. Without accurate profit and credit (<em>udhaar</em>) tracking, small retailers frequently mistake gross cash flow for net earnings, exacerbating working capital crunches.
        </div>

        <div className="overflow-x-auto border border-zinc-200 rounded-md">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-[#F4F3F8] border-b border-zinc-200 text-zinc-800">
                <th className="py-3 px-3.5 font-semibold w-12">Rank</th>
                <th className="py-3 px-3.5 font-semibold min-w-[200px]">Identified Friction</th>
                <th className="py-3 px-3.5 font-semibold min-w-[160px]">Affected Customers</th>
                <th className="py-3 px-3.5 font-semibold min-w-[150px]">When It Occurs</th>
                <th className="py-3 px-3.5 font-semibold min-w-[160px]">Existing Workarounds</th>
                <th className="py-3 px-3.5 font-semibold min-w-[190px]">Supporting Evidence</th>
                <th className="py-3 px-3.5 font-semibold min-w-[190px]">Validation Required</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {CUSTOMER_FRICTION_ROWS.map((row) => (
                <tr key={row.rank} className="hover:bg-zinc-50/80 align-top">
                  <td className="py-3.5 px-3.5 font-mono-tabular font-semibold text-purple-800">
                    #{row.rank}
                  </td>
                  <td className="py-3.5 px-3.5">
                    <div className="font-semibold text-zinc-900">{row.friction}</div>
                    <div className="text-xs text-purple-800 font-medium mt-1">{row.severity}</div>
                  </td>
                  <td className="py-3.5 px-3.5 text-zinc-600 leading-relaxed">{row.affectedCustomers}</td>
                  <td className="py-3.5 px-3.5 text-zinc-600 leading-relaxed">{row.whenItOccurs}</td>
                  <td className="py-3.5 px-3.5 text-zinc-600 leading-relaxed">{row.existingWorkarounds}</td>
                  <td className="py-3.5 px-3.5 text-zinc-600 leading-relaxed">{row.supportingEvidence}</td>
                  <td className="py-3.5 px-3.5 text-zinc-700 leading-relaxed">{row.validationRequired}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 04: JOBS TO BE DONE (JTBD) */}
      <section id="section-4" className="bg-white border border-zinc-200 rounded-lg p-8 sm:p-10 print-break-before print-avoid-break">
        <SectionHeader
          number="04"
          title="Jobs To Be Done (JTBD) Framework"
          subtitle="Deconstructing functional, emotional, and social progress sought by local Dehradun retail proprietors."
          pageNumber="04"
        />

        <div className="bg-[#FAFAFC] border border-zinc-200 rounded-md p-6 mb-7">
          <div className="text-xs font-semibold tracking-wider text-purple-800 mb-2">
            Primary JTBD Statement
          </div>
          <p className="font-display text-lg sm:text-xl text-zinc-900 leading-snug">
            “When closing my shop at the end of the week or settling wholesale supplier bills, help me turn scattered paper slips and UPI receipts into an accurate picture of inventory, customer credit, and real monthly profit—without needing me to learn complex accounting software or pay steep CA fees—so I can run a confident, respected, modern business.”
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-7">
          <div className="border border-zinc-200 rounded-md p-5">
            <div className="text-xs font-semibold text-purple-800 mb-1.5">01 · Functional Job</div>
            <p className="text-sm text-zinc-700 leading-relaxed">
              Accurately manage daily inventory, customer credit (<em>udhaar</em>), supplier payments, and monthly net profits using affordable, accessible digital tools such as standardised Excel dashboards.
            </p>
          </div>
          <div className="border border-zinc-200 rounded-md p-5">
            <div className="text-xs font-semibold text-purple-800 mb-1.5">02 · Emotional Job</div>
            <p className="text-sm text-zinc-700 leading-relaxed">
              Feel confident, calm, and secure about the true financial position of the business—eliminating month-end anxiety over missing cash, overdue credit, or surprise stockouts.
            </p>
          </div>
          <div className="border border-zinc-200 rounded-md p-5">
            <div className="text-xs font-semibold text-purple-800 mb-1.5">03 · Social Job</div>
            <p className="text-sm text-zinc-700 leading-relaxed">
              Be recognised by suppliers, bank loan officers, family members, and local customers as a modern, organised, and professionally managed business owner.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-sm">
          <div className="border border-zinc-200 rounded-md p-5 space-y-3">
            <h3 className="font-semibold text-zinc-900">Situation, Outcome &amp; Addressed Friction</h3>
            <div className="space-y-2 text-zinc-600 leading-relaxed">
              <p><strong>Customer Situation:</strong> Shopkeeper operates 10–12 hours/day handling walk-in cash/UPI sales, wholesale deliveries, and credit customers simultaneously.</p>
              <p><strong>Desired Outcome:</strong> Clean weekly P&amp;L snapshot, zero forgotten credit recoveries, reduced dead stock, and bank-ready records within 30 minutes of weekly review.</p>
              <p><strong>Addressed Friction:</strong> Eliminates manual notebook errors, software abandonment, and ₹4,000+/month CA cost barrier.</p>
            </div>
          </div>

          <div className="border border-zinc-200 rounded-md p-5 space-y-3 bg-[#FAFAFC]">
            <h3 className="font-semibold text-zinc-900">JTBD Progress Formula (Push + Pull &gt; Anxiety + Habit)</h3>
            <div className="grid grid-cols-2 gap-3 text-xs leading-relaxed">
              <div className="bg-white border border-zinc-200 rounded p-3">
                <div className="font-semibold text-purple-900 mb-1">Push of Current Situation</div>
                <p className="text-zinc-600">Cash leaks, lost credit slips, expired shelf stock, inability to prove income for mudra/MSME loans.</p>
              </div>
              <div className="bg-white border border-zinc-200 rounded p-3">
                <div className="font-semibold text-purple-900 mb-1">Pull of New Solution</div>
                <p className="text-zinc-600">On-site weekly student help at ₹1,800 blended cost, clean WhatsApp-readable profit summary.</p>
              </div>
              <div className="bg-white border border-zinc-200 rounded p-3">
                <div className="font-semibold text-zinc-800 mb-1">Anxiety (Mitigated)</div>
                <p className="text-zinc-600">Data confidentiality &amp; student reliability—solved via university ID verification &amp; confidentiality pledges.</p>
              </div>
              <div className="bg-white border border-zinc-200 rounded p-3">
                <div className="font-semibold text-zinc-800 mb-1">Habit Inertia (Mitigated)</div>
                <p className="text-zinc-600">Attachment to paper Bahi-Khata—solved by photographing existing pages rather than forcing immediate typing.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 05: TARGET CUSTOMER & BEACHHEAD SEGMENT */}
      <section id="section-5" className="bg-white border border-zinc-200 rounded-lg p-8 sm:p-10 print-break-before">
        <SectionHeader
          number="05"
          title="Target Customer & Beachhead Segment"
          subtitle="Laser-focused launch within Dhiman Market (Selaqui) before disciplined corridor expansion across Dehradun."
          pageNumber="05"
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-7">
          <div className="lg:col-span-7 border border-purple-200 bg-purple-50/40 rounded-md p-6">
            <div className="text-xs font-semibold tracking-wider text-purple-800 mb-1.5">
              Beachhead Customer Segment
            </div>
            <h3 className="font-display text-xl font-semibold text-zinc-900 mb-3">
              General &amp; Neighbourhood Retail Stores in Dhiman Market (Selaqui), Dehradun
            </h3>
            <p className="text-sm text-zinc-700 leading-relaxed mb-4">
              Dhiman Market in Selaqui sits immediately adjacent to DBS Global University and the Selaqui industrial/residential catchment. It houses a dense concentration of independent general stores, kirana marts, medical/chemist outlets, stationery shops, and mobile/electronics retailers serving factory staff, local families, and hostel students.
            </p>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm pt-3 border-t border-purple-200/70">
              <div>
                <dt className="text-zinc-500">Owner Age &amp; Profile</dt>
                <dd className="font-medium text-zinc-900 mt-0.5">28–52 yrs; sole proprietors or family-operated retailers</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Monthly Turnover Band</dt>
                <dd className="font-mono-tabular font-medium text-zinc-900 mt-0.5">₹1.5 Lakh – ₹8.0 Lakh / month (Est.)</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Willingness to Pay</dt>
                <dd className="font-mono-tabular font-medium text-zinc-900 mt-0.5">₹1,200 – ₹2,000 / month (Hypothesis to test)</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Digital Comfort</dt>
                <dd className="font-medium text-zinc-900 mt-0.5">Daily UPI &amp; WhatsApp users; low Excel/Tally fluency</dd>
              </div>
            </dl>
          </div>

          <div className="lg:col-span-5 border border-zinc-200 rounded-md p-6 flex flex-col justify-between">
            <div>
              <h4 className="text-sm font-semibold text-zinc-900 mb-3">Customer Behaviour &amp; Buying Triggers</h4>
              <ul className="space-y-2.5 text-sm text-zinc-600 leading-relaxed">
                <li><strong>Buying Behaviour:</strong> Relationship-first and cash-flow conscious; prefer seeing a tangible sample ledger or 30-minute free audit on their own shop data before paying.</li>
                <li><strong>Usage Behaviour:</strong> Prefer reviewing a 1-page WhatsApp PDF/image summary every Sunday rather than logging into complex dashboards.</li>
                <li><strong>Acquisition Strategy:</strong> Footwork-led discovery during lean afternoon hours (11 AM–4 PM), leveraging proximity to DBS Global University for reliable weekly follow-ups.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Initial vs Future Expansion Comparison Table */}
        <div className="overflow-x-auto border border-zinc-200 rounded-md">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-[#F4F3F8] border-b border-zinc-200 text-zinc-800">
                <th className="py-3 px-4 font-semibold">Dimension</th>
                <th className="py-3 px-4 font-semibold">Initial Target Market (Months 1–6)</th>
                <th className="py-3 px-4 font-semibold">Future Expansion Market (Months 7–24)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-zinc-700">
              <tr>
                <td className="py-3 px-4 font-medium text-zinc-900">Geography</td>
                <td className="py-3 px-4">Dhiman Market, Selaqui Main Road &amp; Sudhowala (≤ 5 km from campus)</td>
                <td className="py-3 px-4">Prem Nagar, Ballupur, Clement Town, Rajpur Road &amp; Vikasnagar corridors; later Rishikesh/Haridwar</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-zinc-900">Business Verticals</td>
                <td className="py-3 px-4">General stores, kirana marts, stationery &amp; neighbourhood provision shops</td>
                <td className="py-3 px-4">Pharmacies, cafes, coaching institutes, salons, hardware dealers &amp; D2C boutiques</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-zinc-900">Core Service Mix</td>
                <td className="py-3 px-4">Ledger digitisation, Excel bookkeeping &amp; basic SKU inventory sheets</td>
                <td className="py-3 px-4">Bundled MIS + GST-ready prep + WhatsApp commerce &amp; local paid social campaigns</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-zinc-900">Delivery Model</td>
                <td className="py-3 px-4">High-touch weekly in-person visits by DBS Global University student teams</td>
                <td className="py-3 px-4">Hybrid multi-campus hub model with bi-weekly visits + central remote analyst support</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 06: CUSTOMER VALUE PROPOSITION */}
      <section id="section-6" className="bg-white border border-zinc-200 rounded-lg p-8 sm:p-10 print-break-before print-avoid-break">
        <SectionHeader
          number="06"
          title="Customer Value Proposition"
          subtitle="Translating student capability into immediate financial clarity, affordability, and zero-hassle shopkeeper convenience."
          pageNumber="06"
        />

        <div className="bg-purple-900 text-white rounded-md p-6 sm:p-8 mb-7">
          <div className="text-xs font-medium tracking-wider text-purple-200 mb-2">
            Core Value Proposition Statement
          </div>
          <p className="font-display text-xl sm:text-2xl leading-snug">
            For neighbourhood general stores and small retailers in Dehradun who struggle with messy paper registers and unaffordable accountants, Campus Consult Dehradun delivers weekly on-site student bookkeeping, Excel profit-and-inventory clarity, and local digital marketing—starting at ₹1,500—so owners save time, stop stock and credit leaks, and grow professionally without learning complex software.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-6 text-sm">
          <div className="border border-zinc-200 rounded-md p-5">
            <div className="text-xs font-semibold text-purple-800 mb-1">Customer Pain Relieved</div>
            <p className="text-zinc-600 leading-relaxed">
              Eliminates evening hours spent tallying paper slips, stops unrecorded credit write-offs, and removes the ₹4,000–₹10,000/month CA retainer barrier.
            </p>
          </div>
          <div className="border border-zinc-200 rounded-md p-5">
            <div className="text-xs font-semibold text-purple-800 mb-1">Desired Gain Created</div>
            <p className="text-zinc-600 leading-relaxed">
              Clear monthly net-profit &amp; margin sheet, faster inventory turnover, cleaner loan eligibility records, and ready-made festival offer creatives.
            </p>
          </div>
          <div className="border border-zinc-200 rounded-md p-5">
            <div className="text-xs font-semibold text-purple-800 mb-1">Main Customer Benefit</div>
            <p className="text-zinc-600 leading-relaxed">
              <strong>Done-for-you local convenience:</strong> trained student consultants visit the shop counter every week—zero software setup burden on the owner.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-sm">
          <div className="bg-[#FAFAFC] border border-zinc-200 rounded-md p-5">
            <h4 className="font-semibold text-zinc-900 mb-2">Reason to Believe</h4>
            <ul className="space-y-1.5 text-zinc-600 leading-relaxed list-disc pl-4">
              <li>Consultants are vetted MBA/BBA commerce &amp; management students from DBS Global University using faculty-reviewed Excel templates.</li>
              <li>Structured 30-minute free diagnostic proves immediate value on the owner’s actual last-7-days bills before any rupee is charged.</li>
              <li>Transparent, flat-fee packages (₹1,200–₹2,000) align strictly with micro-retail budgets.</li>
            </ul>
          </div>
          <div className="bg-[#FAFAFC] border border-zinc-200 rounded-md p-5">
            <h4 className="font-semibold text-zinc-900 mb-2">Why Choose Campus Consult Instead of Doing Nothing?</h4>
            <p className="text-zinc-600 leading-relaxed">
              Doing nothing (“sticking to Bahi-Khata”) feels free, but carries silent hidden costs: uncollected <em>udhaar</em>, expired shelf inventory, supplier over-billing, and inability to qualify for formal working-capital credit. At ₹50–₹67 per day (₹1,500–₹2,000/month), recovering just 2–3 forgotten credit entries or preventing one dead-stock batch pays for the entire service multiple times over.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
