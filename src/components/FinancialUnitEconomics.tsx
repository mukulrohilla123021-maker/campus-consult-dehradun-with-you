import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { SectionHeader } from './SectionHeader';
import { SCENARIO_PRESETS, SERVICE_PACKAGES } from '../data/venturePlanData';

const formatINR = (val: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Math.round(val));

export function FinancialUnitEconomics() {
  const [activePreset, setActivePreset] = useState<'conservative' | 'base' | 'ambitious'>('base');
  const [customers, setCustomers] = useState<number>(SCENARIO_PRESETS.base.customers);
  const [purchasesPerCustomer, setPurchasesPerCustomer] = useState<number>(
    SCENARIO_PRESETS.base.purchasesPerCustomer
  );
  const [sellingPrice, setSellingPrice] = useState<number>(SCENARIO_PRESETS.base.sellingPrice);
  const [variableCost, setVariableCost] = useState<number>(SCENARIO_PRESETS.base.variableCost);
  const [fixedCosts, setFixedCosts] = useState<number>(SCENARIO_PRESETS.base.fixedCosts);

  const applyPreset = (id: 'conservative' | 'base' | 'ambitious') => {
    const p = SCENARIO_PRESETS[id];
    setActivePreset(id);
    setCustomers(p.customers);
    setPurchasesPerCustomer(p.purchasesPerCustomer);
    setSellingPrice(p.sellingPrice);
    setVariableCost(p.variableCost);
    setFixedCosts(p.fixedCosts);
  };

  // Core Unit Economics Formulas
  const contributionMargin = sellingPrice - variableCost;
  const contributionMarginPct = sellingPrice > 0 ? (contributionMargin / sellingPrice) * 100 : 0;
  const monthlyUnits = customers * purchasesPerCustomer;
  const monthlyRevenue = monthlyUnits * sellingPrice;
  const totalVariableCost = monthlyUnits * variableCost;
  const monthlyContribution = monthlyUnits * contributionMargin;
  const operatingSurplus = monthlyContribution - fixedCosts;
  const breakEvenUnits = contributionMargin > 0 ? fixedCosts / contributionMargin : Infinity;
  const breakEvenCustomers =
    purchasesPerCustomer > 0 && Number.isFinite(breakEvenUnits)
      ? breakEvenUnits / purchasesPerCustomer
      : Infinity;
  const breakEvenRevenue = Number.isFinite(breakEvenUnits) ? breakEvenUnits * sellingPrice : Infinity;

  // Compute all 3 baseline scenarios deterministically for the side-by-side comparison table
  const scenarioRows = (['conservative', 'base', 'ambitious'] as const).map((key) => {
    const s = SCENARIO_PRESETS[key];
    const units = s.customers * s.purchasesPerCustomer;
    const rev = units * s.sellingPrice;
    const vc = units * s.variableCost;
    const cmUnit = s.sellingPrice - s.variableCost;
    const contrib = units * cmUnit;
    const surplus = contrib - s.fixedCosts;
    const bepUnits = s.fixedCosts / cmUnit;
    const bepCust = bepUnits / s.purchasesPerCustomer;
    return { ...s, units, rev, vc, cmUnit, contrib, surplus, bepUnits, bepCust };
  });

  // Break-even SVG Chart scaling
  const maxChartUnits = Math.max(60, Math.ceil(monthlyUnits * 1.25));
  const maxChartY = maxChartUnits * sellingPrice;
  const plotX = (u: number) => 68 + (u / maxChartUnits) * 440;
  const plotY = (inr: number) => 245 - (inr / maxChartY) * 205;

  const bepUnitsClamped = Number.isFinite(breakEvenUnits)
    ? Math.min(maxChartUnits, Math.max(0, breakEvenUnits))
    : 0;
  const bepRevClamped = bepUnitsClamped * sellingPrice;

  return (
    <div className="space-y-8">
      {/* SECTION 09: REVENUE MODEL & PRICING */}
      <section id="section-9" className="bg-white border border-zinc-200 rounded-lg p-8 sm:p-10 print-break-before">
        <SectionHeader
          number="09"
          title="Revenue Model & Pricing Architecture"
          subtitle="Modular INR service pricing tailored to neighbourhood retail cash flows, combining one-time onboarding with recurring retainers."
          pageNumber="09"
        />

        {/* Service Packages Table */}
        <h3 className="text-base font-semibold text-zinc-900 mb-3">
          Service Package Menu &amp; Blended Unit Structure
        </h3>
        <div className="overflow-x-auto border border-zinc-200 rounded-md mb-8">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-[#F4F3F8] border-b border-zinc-200 text-zinc-800">
                <th className="py-3 px-3.5 font-semibold">Code</th>
                <th className="py-3 px-3.5 font-semibold min-w-[200px]">Service Package</th>
                <th className="py-3 px-3.5 font-semibold">Cadence</th>
                <th className="py-3 px-3.5 font-semibold text-right">Selling Price</th>
                <th className="py-3 px-3.5 font-semibold text-right">Variable Cost</th>
                <th className="py-3 px-3.5 font-semibold text-right">Contribution</th>
                <th className="py-3 px-3.5 font-semibold min-w-[240px]">Core Deliverables</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {SERVICE_PACKAGES.map((pkg) => (
                <tr key={pkg.code} className="hover:bg-zinc-50/70 align-top">
                  <td className="py-3 px-3.5 font-mono-tabular font-semibold text-purple-800">{pkg.code}</td>
                  <td className="py-3 px-3.5">
                    <div className="font-semibold text-zinc-900">{pkg.name}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">{pkg.targetUseCase}</div>
                  </td>
                  <td className="py-3 px-3.5 text-zinc-600 whitespace-nowrap">{pkg.billingType}</td>
                  <td className="py-3 px-3.5 font-mono-tabular text-right font-semibold text-zinc-900">
                    {formatINR(pkg.priceInr)}
                  </td>
                  <td className="py-3 px-3.5 font-mono-tabular text-right text-zinc-600">
                    {formatINR(pkg.variableCostInr)}
                  </td>
                  <td className="py-3 px-3.5 font-mono-tabular text-right font-semibold text-purple-800">
                    {formatINR(pkg.contributionInr)}
                  </td>
                  <td className="py-3 px-3.5 text-zinc-600 leading-relaxed">{pkg.deliverables}</td>
                </tr>
              ))}
              <tr className="bg-[#FAFAFC] font-semibold">
                <td className="py-3 px-3.5 font-mono-tabular text-purple-900">AVG</td>
                <td className="py-3 px-3.5 text-zinc-900" colSpan={2}>
                  Blended Consulting Unit (Standard Modelling Benchmark)
                </td>
                <td className="py-3 px-3.5 font-mono-tabular text-right text-zinc-900">₹1,800</td>
                <td className="py-3 px-3.5 font-mono-tabular text-right text-zinc-700">₹1,050</td>
                <td className="py-3 px-3.5 font-mono-tabular text-right text-purple-900">₹750</td>
                <td className="py-3 px-3.5 font-normal text-xs text-zinc-600">
                  Weighted mix across ₹1,500 setups, ₹2,000 bookkeeping, ₹1,800 inventory audits &amp; ₹1,200 design packs.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Variable & Fixed Cost Assumptions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 text-sm">
          <div className="border border-zinc-200 rounded-md p-5">
            <h4 className="font-semibold text-zinc-900 mb-3">Variable Cost Breakdown per Blended Unit (₹1,050)</h4>
            <dl className="space-y-2.5">
              <div className="flex justify-between py-1.5 border-b border-zinc-100">
                <dt className="text-zinc-600">Student Consultant Stipend (50% revenue share)</dt>
                <dd className="font-mono-tabular font-semibold text-zinc-900">₹900</dd>
              </div>
              <div className="flex justify-between py-1.5 border-b border-zinc-100">
                <dt className="text-zinc-600">Local Transit Allowance (Selaqui / Dehradun visits)</dt>
                <dd className="font-mono-tabular font-semibold text-zinc-900">₹100</dd>
              </div>
              <div className="flex justify-between py-1.5 border-b border-zinc-100">
                <dt className="text-zinc-600">Printed Folders, Stationery &amp; UPI/Gateway Charges</dt>
                <dd className="font-mono-tabular font-semibold text-zinc-900">₹50</dd>
              </div>
              <div className="flex justify-between pt-1.5 font-semibold">
                <dt className="text-zinc-900">Total Variable Cost per Unit</dt>
                <dd className="font-mono-tabular text-purple-900">₹1,050</dd>
              </div>
            </dl>
          </div>

          <div className="border border-zinc-200 rounded-md p-5">
            <h4 className="font-semibold text-zinc-900 mb-3">Monthly Fixed Operating Costs (₹12,000 / month)</h4>
            <dl className="space-y-2.5">
              <div className="flex justify-between py-1.5 border-b border-zinc-100">
                <dt className="text-zinc-600">Marketing, Bilingual Rate Cards &amp; Local Ads (GTM Budget)</dt>
                <dd className="font-mono-tabular font-semibold text-zinc-900">₹3,500</dd>
              </div>
              <div className="flex justify-between py-1.5 border-b border-zinc-100">
                <dt className="text-zinc-600">Campus Operations Desk, Wi-Fi &amp; Coordination Utilities</dt>
                <dd className="font-mono-tabular font-semibold text-zinc-900">₹3,000</dd>
              </div>
              <div className="flex justify-between py-1.5 border-b border-zinc-100">
                <dt className="text-zinc-600">Student Training, QA Review &amp; Admin Contingency</dt>
                <dd className="font-mono-tabular font-semibold text-zinc-900">₹3,000</dd>
              </div>
              <div className="flex justify-between py-1.5 border-b border-zinc-100">
                <dt className="text-zinc-600">Cloud Software (Google Workspace, Canva Pro, MIS Tools)</dt>
                <dd className="font-mono-tabular font-semibold text-zinc-900">₹2,500</dd>
              </div>
              <div className="flex justify-between pt-1.5 font-semibold">
                <dt className="text-zinc-900">Total Monthly Fixed Operating Cost</dt>
                <dd className="font-mono-tabular text-purple-900">₹12,000</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* 3-Scenario Comparison Table */}
        <h3 className="text-base font-semibold text-zinc-900 mb-3">
          Three-Scenario Monthly Financial Projection (Conservative · Base · Ambitious)
        </h3>
        <div className="overflow-x-auto border border-zinc-200 rounded-md">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-[#F4F3F8] border-b border-zinc-200 text-zinc-800">
                <th className="py-3 px-4 font-semibold">Financial Line Item</th>
                <th className="py-3 px-4 font-semibold text-right">Conservative (Pilot)</th>
                <th className="py-3 px-4 font-semibold text-right text-purple-900">Base (Steady State)</th>
                <th className="py-3 px-4 font-semibold text-right">Ambitious (Expansion)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              <tr>
                <td className="py-2.5 px-4 font-medium text-zinc-800">Expected Monthly Customers</td>
                {scenarioRows.map((s) => (
                  <td key={s.id} className="py-2.5 px-4 font-mono-tabular text-right">{s.customers}</td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-medium text-zinc-800">Purchases per Customer / Month</td>
                {scenarioRows.map((s) => (
                  <td key={s.id} className="py-2.5 px-4 font-mono-tabular text-right">{s.purchasesPerCustomer.toFixed(2)}</td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-medium text-zinc-800">Total Monthly Units</td>
                {scenarioRows.map((s) => (
                  <td key={s.id} className="py-2.5 px-4 font-mono-tabular text-right font-semibold">{s.units}</td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-medium text-zinc-800">Selling Price per Unit</td>
                {scenarioRows.map((s) => (
                  <td key={s.id} className="py-2.5 px-4 font-mono-tabular text-right">{formatINR(s.sellingPrice)}</td>
                ))}
              </tr>
              <tr className="bg-[#FAFAFC]">
                <td className="py-2.5 px-4 font-semibold text-zinc-900">Expected Monthly Revenue</td>
                {scenarioRows.map((s) => (
                  <td key={s.id} className="py-2.5 px-4 font-mono-tabular text-right font-semibold text-zinc-900">{formatINR(s.rev)}</td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 px-4 text-zinc-700">Total Variable Costs (₹1,050/unit)</td>
                {scenarioRows.map((s) => (
                  <td key={s.id} className="py-2.5 px-4 font-mono-tabular text-right text-zinc-600">({formatINR(s.vc)})</td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-medium text-zinc-900">Total Monthly Contribution (41.67%)</td>
                {scenarioRows.map((s) => (
                  <td key={s.id} className="py-2.5 px-4 font-mono-tabular text-right font-semibold text-purple-800">{formatINR(s.contrib)}</td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 px-4 text-zinc-700">Monthly Fixed Operating Costs</td>
                {scenarioRows.map((s) => (
                  <td key={s.id} className="py-2.5 px-4 font-mono-tabular text-right text-zinc-600">({formatINR(s.fixedCosts)})</td>
                ))}
              </tr>
              <tr className="bg-purple-50/60 font-semibold">
                <td className="py-3 px-4 text-zinc-900">Monthly Operating Surplus / (Deficit)</td>
                {scenarioRows.map((s) => (
                  <td
                    key={s.id}
                    className={`py-3 px-4 font-mono-tabular text-right ${
                      s.surplus < 0 ? 'text-rose-700' : 'text-emerald-800'
                    }`}
                  >
                    {s.surplus < 0 ? `(${formatINR(Math.abs(s.surplus))})` : `+${formatINR(s.surplus)}`}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 10: UNIT ECONOMICS & INTERACTIVE SIMULATOR */}
      <section id="section-10" className="bg-white border border-zinc-200 rounded-lg p-8 sm:p-10 print-break-before">
        <SectionHeader
          number="10"
          title="Unit Economics & Break-Even Analysis"
          subtitle="Interactive financial model showing mathematical unit-economics derivations, margin sensitivity, and break-even thresholds."
          pageNumber="11"
        />

        {/* Interactive Scenario Selector & Sensitivity Controls */}
        <div className="no-print bg-[#FAFAFC] border border-zinc-200 rounded-md p-5 mb-7">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-4 border-b border-zinc-200">
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-zinc-200/70 rounded-md">
              {(['conservative', 'base', 'ambitious'] as const).map((presetKey) => (
                <button
                  key={presetKey}
                  type="button"
                  onClick={() => applyPreset(presetKey)}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activePreset === presetKey
                      ? 'bg-purple-800 text-white'
                      : 'text-zinc-700 hover:text-zinc-900 hover:bg-white/70'
                  }`}
                >
                  {SCENARIO_PRESETS[presetKey].label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => applyPreset('base')}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 hover:text-purple-800 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Reset to Base Case</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-xs">
            <label className="block">
              <div className="flex justify-between font-medium text-zinc-700 mb-1">
                <span>Monthly Customers</span>
                <span className="font-mono-tabular text-purple-900">{customers}</span>
              </div>
              <input
                type="range"
                min={4}
                max={60}
                step={1}
                value={customers}
                onChange={(e) => setCustomers(Number(e.target.value))}
                className="w-full accent-purple-800 cursor-pointer"
              />
            </label>
            <label className="block">
              <div className="flex justify-between font-medium text-zinc-700 mb-1">
                <span>Units / Customer</span>
                <span className="font-mono-tabular text-purple-900">{purchasesPerCustomer.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={1}
                max={2}
                step={0.05}
                value={purchasesPerCustomer}
                onChange={(e) => setPurchasesPerCustomer(Number(e.target.value))}
                className="w-full accent-purple-800 cursor-pointer"
              />
            </label>
            <label className="block">
              <div className="flex justify-between font-medium text-zinc-700 mb-1">
                <span>Selling Price</span>
                <span className="font-mono-tabular text-purple-900">{formatINR(sellingPrice)}</span>
              </div>
              <input
                type="range"
                min={1200}
                max={2500}
                step={100}
                value={sellingPrice}
                onChange={(e) => setSellingPrice(Number(e.target.value))}
                className="w-full accent-purple-800 cursor-pointer"
              />
            </label>
            <label className="block">
              <div className="flex justify-between font-medium text-zinc-700 mb-1">
                <span>Variable Cost</span>
                <span className="font-mono-tabular text-purple-900">{formatINR(variableCost)}</span>
              </div>
              <input
                type="range"
                min={700}
                max={1500}
                step={50}
                value={variableCost}
                onChange={(e) => setVariableCost(Number(e.target.value))}
                className="w-full accent-purple-800 cursor-pointer"
              />
            </label>
            <label className="block">
              <div className="flex justify-between font-medium text-zinc-700 mb-1">
                <span>Fixed Costs</span>
                <span className="font-mono-tabular text-purple-900">{formatINR(fixedCosts)}</span>
              </div>
              <input
                type="range"
                min={6000}
                max={24000}
                step={1000}
                value={fixedCosts}
                onChange={(e) => setFixedCosts(Number(e.target.value))}
                className="w-full accent-purple-800 cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Live KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          <div className="border border-zinc-200 rounded-md p-4">
            <div className="text-xs text-zinc-500">Contribution Margin</div>
            <div className="font-mono-tabular text-xl font-semibold text-zinc-900 mt-1">
              {formatINR(contributionMargin)}
            </div>
            <div className="font-mono-tabular text-xs text-purple-800 mt-0.5">
              {contributionMarginPct.toFixed(2)}% of Price
            </div>
          </div>
          <div className="border border-zinc-200 rounded-md p-4">
            <div className="text-xs text-zinc-500">Expected Monthly Units</div>
            <div className="font-mono-tabular text-xl font-semibold text-zinc-900 mt-1">
              {monthlyUnits.toFixed(1).replace(/\.0$/, '')} units
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">
              {customers} cust × {purchasesPerCustomer.toFixed(2)}
            </div>
          </div>
          <div className="border border-zinc-200 rounded-md p-4">
            <div className="text-xs text-zinc-500">Expected Revenue</div>
            <div className="font-mono-tabular text-xl font-semibold text-zinc-900 mt-1">
              {formatINR(monthlyRevenue)}
            </div>
            <div className="font-mono-tabular text-xs text-zinc-500 mt-0.5">
              Contrib: {formatINR(monthlyContribution)}
            </div>
          </div>
          <div className="border border-zinc-200 rounded-md p-4">
            <div className="text-xs text-zinc-500">Operating Surplus / Deficit</div>
            <div
              className={`font-mono-tabular text-xl font-semibold mt-1 ${
                operatingSurplus < 0 ? 'text-rose-700' : 'text-emerald-800'
              }`}
            >
              {operatingSurplus < 0
                ? `-${formatINR(Math.abs(operatingSurplus))}`
                : `+${formatINR(operatingSurplus)}`}
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">
              {operatingSurplus >= 0 ? 'Profitable above BEP' : 'Below Break-Even'}
            </div>
          </div>
          <div className="border border-purple-200 bg-purple-50/50 rounded-md p-4 col-span-2 sm:col-span-1">
            <div className="text-xs text-purple-900 font-medium">Break-Even Threshold</div>
            <div className="font-mono-tabular text-xl font-semibold text-purple-900 mt-1">
              {Number.isFinite(breakEvenUnits) ? `${breakEvenUnits.toFixed(1).replace(/\.0$/, '')} units` : 'N/A'}
            </div>
            <div className="font-mono-tabular text-xs text-purple-800 mt-0.5">
              {Number.isFinite(breakEvenCustomers)
                ? `${Math.ceil(breakEvenCustomers)} customers (${formatINR(breakEvenRevenue)})`
                : 'Negative margin'}
            </div>
          </div>
        </div>

        {/* Break-Even Chart + Formula Table */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* SVG Break-Even Chart */}
          <div className="lg:col-span-6 border border-zinc-200 rounded-md p-5 bg-[#FAFAFC]">
            <h4 className="text-sm font-semibold text-zinc-900 mb-1">
              Cost-Volume-Profit Break-Even Curve
            </h4>
            <p className="text-xs text-zinc-500 mb-3">
              Total Revenue vs. Total Cost across 0–{maxChartUnits} monthly consulting units.
            </p>
            <svg viewBox="0 0 540 285" className="w-full h-auto bg-white border border-zinc-200 rounded" role="img" aria-label="Break-even line chart showing revenue intersecting total cost">
              {/* Horizontal Grid Lines */}
              {[0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = 245 - ratio * 205;
                const val = maxChartY * ratio;
                return (
                  <g key={ratio}>
                    <line x1="68" y1={y} x2="508" y2={y} stroke="#F4F4F5" strokeWidth="1" />
                    <text x="62" y={y + 4} fontSize="9.5" fill="#71717A" textAnchor="end" fontFamily="JetBrains Mono, monospace">
                      ₹{Math.round(val / 1000)}k
                    </text>
                  </g>
                );
              })}

              {/* Axes */}
              <line x1="68" y1="35" x2="68" y2="245" stroke="#A1A1AA" strokeWidth="1.2" />
              <line x1="68" y1="245" x2="508" y2="245" stroke="#A1A1AA" strokeWidth="1.2" />

              {/* Fixed Cost Line */}
              <line
                x1={plotX(0)}
                y1={plotY(Math.min(maxChartY, fixedCosts))}
                x2={plotX(maxChartUnits)}
                y2={plotY(Math.min(maxChartY, fixedCosts))}
                stroke="#A1A1AA"
                strokeDasharray="4 4"
                strokeWidth="1.5"
              />

              {/* Total Cost Line */}
              <line
                x1={plotX(0)}
                y1={plotY(Math.min(maxChartY, fixedCosts))}
                x2={plotX(maxChartUnits)}
                y2={plotY(Math.min(maxChartY, fixedCosts + maxChartUnits * variableCost))}
                stroke="#52525B"
                strokeWidth="2.2"
              />

              {/* Total Revenue Line */}
              <line
                x1={plotX(0)}
                y1={plotY(0)}
                x2={plotX(maxChartUnits)}
                y2={plotY(maxChartY)}
                stroke="#6D28D9"
                strokeWidth="2.5"
              />

              {/* Break-Even Point Marker */}
              {contributionMargin > 0 && bepUnitsClamped <= maxChartUnits && (
                <g>
                  <line
                    x1={plotX(bepUnitsClamped)}
                    y1={plotY(bepRevClamped)}
                    x2={plotX(bepUnitsClamped)}
                    y2="245"
                    stroke="#7C3AED"
                    strokeDasharray="3 3"
                    strokeWidth="1.2"
                  />
                  <circle cx={plotX(bepUnitsClamped)} cy={plotY(bepRevClamped)} r="5.5" fill="#5B21B6" stroke="#FFFFFF" strokeWidth="2" />
                  <text
                    x={plotX(bepUnitsClamped) + 8}
                    y={plotY(bepRevClamped) - 8}
                    fontSize="10"
                    fontWeight="600"
                    fill="#4C1D95"
                  >
                    BEP: {breakEvenUnits.toFixed(1).replace(/\.0$/, '')} units
                  </text>
                </g>
              )}

              {/* Current Active Scenario Marker */}
              <circle
                cx={plotX(Math.min(maxChartUnits, monthlyUnits))}
                cy={plotY(Math.min(maxChartY, monthlyRevenue))}
                r="5"
                fill="#18181B"
                stroke="#FFFFFF"
                strokeWidth="1.5"
              />

              {/* X-Axis Ticks */}
              {[0, Math.round(maxChartUnits * 0.25), Math.round(maxChartUnits * 0.5), Math.round(maxChartUnits * 0.75), maxChartUnits].map((u) => (
                <text key={u} x={plotX(u)} y="262" fontSize="9.5" fill="#71717A" textAnchor="middle" fontFamily="JetBrains Mono, monospace">
                  {u}u
                </text>
              ))}

              {/* Legend */}
              <line x1="80" y1="22" x2="98" y2="22" stroke="#6D28D9" strokeWidth="2.5" />
              <text x="103" y="25" fontSize="10" fill="#27272A">Total Revenue</text>
              <line x1="195" y1="22" x2="213" y2="22" stroke="#52525B" strokeWidth="2.2" />
              <text x="218" y="25" fontSize="10" fill="#27272A">Total Cost</text>
              <line x1="290" y1="22" x2="308" y2="22" stroke="#A1A1AA" strokeDasharray="4 4" strokeWidth="1.5" />
              <text x="313" y="25" fontSize="10" fill="#52525B">Fixed Cost ({formatINR(fixedCosts)})</text>
            </svg>
          </div>

          {/* Mathematical Formula Proof Table */}
          <div className="lg:col-span-6 overflow-x-auto border border-zinc-200 rounded-md">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F4F3F8] border-b border-zinc-200 text-zinc-800">
                  <th className="py-2.5 px-3 font-semibold">Metric</th>
                  <th className="py-2.5 px-3 font-semibold">Formula &amp; Calculation</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                <tr>
                  <td className="py-2.5 px-3 font-medium text-zinc-900">Selling Price / Unit (P)</td>
                  <td className="py-2.5 px-3 text-zinc-600">Blended average unit fee</td>
                  <td className="py-2.5 px-3 font-mono-tabular text-right font-semibold">{formatINR(sellingPrice)}</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-medium text-zinc-900">Variable Cost / Unit (VC)</td>
                  <td className="py-2.5 px-3 text-zinc-600">Stipend + travel + materials</td>
                  <td className="py-2.5 px-3 font-mono-tabular text-right">{formatINR(variableCost)}</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-medium text-zinc-900">Contribution Margin (CM)</td>
                  <td className="py-2.5 px-3 font-mono-tabular text-zinc-600">P − VC = {formatINR(sellingPrice)} − {formatINR(variableCost)}</td>
                  <td className="py-2.5 px-3 font-mono-tabular text-right font-semibold text-purple-800">{formatINR(contributionMargin)}</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-medium text-zinc-900">Contribution Margin %</td>
                  <td className="py-2.5 px-3 font-mono-tabular text-zinc-600">(CM / P) × 100</td>
                  <td className="py-2.5 px-3 font-mono-tabular text-right font-semibold">{contributionMarginPct.toFixed(2)}%</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-medium text-zinc-900">Monthly Units (Q)</td>
                  <td className="py-2.5 px-3 font-mono-tabular text-zinc-600">{customers} × {purchasesPerCustomer.toFixed(2)}</td>
                  <td className="py-2.5 px-3 font-mono-tabular text-right font-semibold">{monthlyUnits.toFixed(1).replace(/\.0$/, '')}</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-medium text-zinc-900">Monthly Revenue (R)</td>
                  <td className="py-2.5 px-3 font-mono-tabular text-zinc-600">Q × P</td>
                  <td className="py-2.5 px-3 font-mono-tabular text-right font-semibold">{formatINR(monthlyRevenue)}</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-medium text-zinc-900">Monthly Contribution</td>
                  <td className="py-2.5 px-3 font-mono-tabular text-zinc-600">Q × CM</td>
                  <td className="py-2.5 px-3 font-mono-tabular text-right font-semibold">{formatINR(monthlyContribution)}</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-medium text-zinc-900">Operating Surplus / (Deficit)</td>
                  <td className="py-2.5 px-3 font-mono-tabular text-zinc-600">(Q × CM) − FC</td>
                  <td className={`py-2.5 px-3 font-mono-tabular text-right font-semibold ${operatingSurplus < 0 ? 'text-rose-700' : 'text-emerald-800'}`}>
                    {operatingSurplus < 0 ? `(${formatINR(Math.abs(operatingSurplus))})` : `+${formatINR(operatingSurplus)}`}
                  </td>
                </tr>
                <tr className="bg-purple-50/50">
                  <td className="py-2.5 px-3 font-semibold text-purple-950">Break-Even Volume (Units)</td>
                  <td className="py-2.5 px-3 font-mono-tabular text-purple-900">FC / CM = {formatINR(fixedCosts)} / {formatINR(contributionMargin)}</td>
                  <td className="py-2.5 px-3 font-mono-tabular text-right font-semibold text-purple-900">
                    {Number.isFinite(breakEvenUnits) ? `${breakEvenUnits.toFixed(1).replace(/\.0$/, '')} units` : 'N/A'}
                  </td>
                </tr>
                <tr className="bg-purple-50/50">
                  <td className="py-2.5 px-3 font-semibold text-purple-950">Break-Even Customers</td>
                  <td className="py-2.5 px-3 font-mono-tabular text-purple-900">BEP Units / {purchasesPerCustomer.toFixed(2)}</td>
                  <td className="py-2.5 px-3 font-mono-tabular text-right font-semibold text-purple-900">
                    {Number.isFinite(breakEvenCustomers) ? `${breakEvenCustomers.toFixed(1)} → ${Math.ceil(breakEvenCustomers)}` : 'N/A'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
