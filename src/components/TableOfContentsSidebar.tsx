import { TOC_ITEMS } from '../data/venturePlanData';

interface TableOfContentsSidebarProps {
  activeSection: string;
  onNavigate: (id: string) => void;
}

export function TableOfContentsSidebar({ activeSection, onNavigate }: TableOfContentsSidebarProps) {
  return (
    <aside
      aria-label="Document contents"
      className="no-print hidden xl:block w-72 shrink-0"
    >
      <div className="sticky top-24 bg-white border border-zinc-200 rounded-lg p-5 max-h-[calc(100vh-7.5rem)] overflow-y-auto">
        <div className="pb-3 mb-3 border-b border-zinc-200">
          <div className="text-xs font-semibold tracking-wide text-purple-800">
            Table of Contents
          </div>
          <div className="text-xs text-zinc-500 mt-0.5">
            17 Strategic Blueprint Sections
          </div>
        </div>
        <nav className="space-y-0.5">
          <a
            href="#cover"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('cover');
            }}
            className={`flex items-center justify-between px-2.5 py-1.5 text-xs rounded transition-colors ${
              activeSection === 'cover'
                ? 'bg-purple-50 text-purple-900 font-semibold'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
            }`}
          >
            <span className="truncate">Cover &amp; Dossier Summary</span>
            <span className="font-mono-tabular text-[11px] text-zinc-400 shrink-0 ml-2">i</span>
          </a>
          <a
            href="#toc-page"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('toc-page');
            }}
            className={`flex items-center justify-between px-2.5 py-1.5 text-xs rounded transition-colors ${
              activeSection === 'toc-page'
                ? 'bg-purple-50 text-purple-900 font-semibold'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
            }`}
          >
            <span className="truncate">Formal Index</span>
            <span className="font-mono-tabular text-[11px] text-zinc-400 shrink-0 ml-2">ii</span>
          </a>

          <div className="my-2 border-t border-zinc-100" />

          {TOC_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(item.id);
                }}
                className={`flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs rounded transition-colors ${
                  isActive
                    ? 'bg-purple-50 text-purple-900 font-semibold'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
                }`}
              >
                <span className="truncate">
                  <span className={`font-mono-tabular mr-1.5 ${isActive ? 'text-purple-700' : 'text-zinc-400'}`}>
                    {item.number}.
                  </span>
                  {item.title}
                </span>
                <span className="font-mono-tabular text-[11px] text-zinc-400 shrink-0">
                  {item.pageNumber}
                </span>
              </a>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
