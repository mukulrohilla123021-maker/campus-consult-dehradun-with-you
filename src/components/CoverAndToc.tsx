import { useState } from 'react';
import { STUDENT_DETAILS, TOC_ITEMS } from '../data/venturePlanData';

interface CoverAndTocProps {
  onNavigate: (id: string) => void;
}

export function CoverAndToc({ onNavigate }: CoverAndTocProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="space-y-8">
      {/* Formal MBA Cover Page */}
      <section
        id="cover"
        className="bg-white border border-zinc-200 rounded-lg overflow-hidden print-avoid-break"
      >
        {/* Top Institutional Purple Accent Rule */}
        <div className="h-2 bg-purple-800 w-full" />

        <div className="p-8 sm:p-12 lg:p-14">
          {/* Institutional Header Metadata */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-zinc-200 text-xs font-medium text-zinc-600">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-purple-900">DBS Global University</span>
              <span aria-hidden="true">·</span>
              <span>School of Management</span>
            </div>
            <div className="flex items-center gap-2">
              <span>Entrepreneurship &amp; Innovation</span>
              <span aria-hidden="true">·</span>
              <span>Assignment 1</span>
            </div>
          </div>

          {/* Main Cover Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch mt-8">
            <div className="lg:col-span-7 flex flex-col justify-between">
              <div>
                <p className="text-xs font-semibold tracking-wider text-purple-800 mb-3">
                  Consolidated Strategic Blueprint · Complete Venture Plan
                </p>
                <h1 className="font-display text-4xl sm:text-5xl font-semibold text-zinc-900 tracking-tight leading-[1.1]">
                  Campus Consult Dehradun
                </h1>
                <p className="mt-4 text-base sm:text-lg text-zinc-600 leading-relaxed max-w-xl">
                  A student-led micro-consulting platform bridging university management talent with local small retailers in Dhiman Market (Selaqui) and greater Dehradun through affordable bookkeeping, Excel MIS, inventory control, and digital marketing support.
                </p>
              </div>

              {/* Submission Identity Ledger */}
              <div className="mt-8 pt-6 border-t border-zinc-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-xs text-zinc-500">Submitted By</div>
                  <div className="font-semibold text-zinc-900 mt-0.5">{STUDENT_DETAILS.studentName}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500">Roll Number</div>
                  <div className="font-mono-tabular font-semibold text-zinc-900 mt-0.5">{STUDENT_DETAILS.rollNumber}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500">Institution</div>
                  <div className="font-semibold text-zinc-900 mt-0.5">{STUDENT_DETAILS.university}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500">Beachhead Hub</div>
                  <div className="font-semibold text-zinc-900 mt-0.5">Dhiman Market, Selaqui</div>
                </div>
              </div>
            </div>

            {/* Cover Editorial Photograph */}
            <div className="lg:col-span-5 flex flex-col">
              <div className="relative flex-1 min-h-[240px] rounded-md overflow-hidden border border-zinc-200 bg-zinc-100">
                {!imgError ? (
                  <img
                    src="/src/assets/images/dehradun_market_cover_1794978259475.jpg"
                    alt="Neighbourhood general stores and local retail corridor in Dehradun foothills"
                    referrerPolicy="no-referrer"
                    onError={() => setImgError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-purple-50 to-zinc-100">
                    <span className="font-display text-lg font-semibold text-purple-900">Dehradun Retail Corridor</span>
                    <span className="text-xs text-zinc-500 mt-1">Selaqui &amp; Neighbourhood Commerce</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-zinc-500 mt-2 italic">
                Fig. 1 — Neighbourhood retail corridor in Dehradun representing the primary micro-consulting target market.
              </p>
            </div>
          </div>

          {/* Executive Key Figures Ribbon */}
          <div className="mt-8 pt-6 border-t border-zinc-200 grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <div className="text-xs text-zinc-500">Blended Service Price</div>
              <div className="font-mono-tabular text-2xl font-semibold text-zinc-900 mt-1">₹1,800</div>
              <div className="text-xs text-zinc-500 mt-0.5">Per consulting unit</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Contribution Margin</div>
              <div className="font-mono-tabular text-2xl font-semibold text-purple-800 mt-1">₹750 · 41.67%</div>
              <div className="text-xs text-zinc-500 mt-0.5">₹1,050 variable cost/unit</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Monthly Break-Even</div>
              <div className="font-mono-tabular text-2xl font-semibold text-zinc-900 mt-1">16 Units</div>
              <div className="text-xs text-zinc-500 mt-0.5">13 active customers (₹28,800)</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Year 1 Obtainable Market</div>
              <div className="font-mono-tabular text-2xl font-semibold text-zinc-900 mt-1">₹8.10 Lakh</div>
              <div className="text-xs text-zinc-500 mt-0.5">30 steady customers (0.17% SAM)</div>
            </div>
          </div>
        </div>
      </section>

      {/* Formal Table of Contents Page */}
      <section
        id="toc-page"
        className="bg-white border border-zinc-200 rounded-lg p-8 sm:p-10 print-break-before print-avoid-break"
      >
        <div className="flex items-baseline justify-between border-b border-zinc-200 pb-4 mb-6">
          <div>
            <div className="text-xs font-semibold tracking-wider text-purple-800">Document Index</div>
            <h2 className="font-display text-2xl font-semibold text-zinc-900 mt-1">
              Table of Contents
            </h2>
          </div>
          <span className="font-mono-tabular text-xs text-zinc-500">Page ii</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-2">
          {TOC_ITEMS.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={(e) => {
                e.preventDefault();
                onNavigate(item.id);
              }}
              className="group flex items-baseline justify-between py-2 border-b border-zinc-100 hover:border-purple-300 transition-colors"
            >
              <div className="flex items-baseline gap-3 pr-3 min-w-0">
                <span className="font-mono-tabular text-xs font-semibold text-purple-800 shrink-0">
                  {item.number}
                </span>
                <span className="text-sm text-zinc-800 group-hover:text-purple-900 font-medium truncate">
                  {item.title}
                </span>
              </div>
              <span className="font-mono-tabular text-xs text-zinc-500 group-hover:text-purple-800 shrink-0">
                p. {item.pageNumber}
              </span>
            </a>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-zinc-200 flex flex-wrap items-center justify-between gap-4 text-xs text-zinc-500">
          <span>All financial projections denominated in Indian Rupees (INR).</span>
          <span>Secondary benchmarks separated clearly from untested operational hypotheses.</span>
        </div>
      </section>
    </div>
  );
}
