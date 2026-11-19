interface SectionHeaderProps {
  number: string;
  title: string;
  subtitle?: string;
  pageNumber: string;
}

export function SectionHeader({ number, title, subtitle, pageNumber }: SectionHeaderProps) {
  return (
    <div className="border-b border-zinc-200 pb-5 mb-7">
      <div className="flex items-baseline justify-between gap-4 text-xs font-medium tracking-wider text-zinc-500 mb-2">
        <span className="text-purple-800 font-semibold">Section {number}</span>
        <span className="font-mono-tabular">Page {pageNumber} of 18</span>
      </div>
      <h2 className="font-display text-2xl sm:text-3xl font-semibold text-zinc-900 tracking-tight">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-2 text-sm sm:text-base text-zinc-600 max-w-3xl leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
}
