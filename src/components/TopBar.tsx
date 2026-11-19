import { Printer } from 'lucide-react';

interface TopBarProps {
  onPrint: () => void;
}

export function TopBar({ onPrint }: TopBarProps) {
  return (
    <header className="no-print sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-zinc-200">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-element Brand Wordmark */}
        <a
          href="#cover"
          className="font-display text-lg font-semibold tracking-tight text-zinc-900 whitespace-nowrap shrink-0 hover:text-purple-800 transition-colors"
        >
          Campus Consult Dehradun
        </a>

        {/* Zone 2: 4 single-line navigation links */}
        <nav aria-label="Primary sections" className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-600">
          <a
            href="#section-2"
            className="hover:text-purple-800 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Blueprint
          </a>
          <a
            href="#section-9"
            className="hover:text-purple-800 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Financials
          </a>
          <a
            href="#section-12"
            className="hover:text-purple-800 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Launch Plan
          </a>
          <a
            href="#section-15"
            className="hover:text-purple-800 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Validation
          </a>
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onPrint}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-800 hover:bg-purple-900 rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-700 cursor-pointer"
          >
            <Printer className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>
    </header>
  );
}
