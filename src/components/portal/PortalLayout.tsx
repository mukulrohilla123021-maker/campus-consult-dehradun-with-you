import { useState, type ReactNode } from 'react';
import { Bell, Globe, LogOut, Menu, Search, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { formatDateTime } from '../../lib/api';

export interface SidebarNavItem {
  id: string;
  label: string;
}

interface PortalLayoutProps {
  roleLabel: string;
  navItems: SidebarNavItem[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  onGoPublic: () => void;
  globalSearch?: string;
  onGlobalSearchChange?: (val: string) => void;
  children: ReactNode;
}

export function PortalLayout({
  roleLabel,
  navItems,
  activeTab,
  onTabChange,
  onGoPublic,
  globalSearch = '',
  onGlobalSearchChange,
  children,
}: PortalLayoutProps) {
  const { user, notifications, unreadNotifications, markAllNotificationsRead, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-[#F7F7F9] text-zinc-900">
      {/* Desktop Sidebar */}
      <aside className="no-print hidden lg:flex lg:flex-col lg:w-64 shrink-0 bg-white border-r border-zinc-200 sticky top-0 h-screen">
        <div className="h-16 px-5 border-b border-zinc-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onGoPublic}
            className="font-display text-base font-semibold text-zinc-900 hover:text-purple-800 truncate cursor-pointer"
          >
            Campus Consult
          </button>
        </div>
        <div className="px-5 py-3 border-b border-zinc-100 bg-[#FAFAFC]">
          <div className="text-[11px] font-semibold text-purple-800 tracking-wide">{roleLabel}</div>
          <div className="text-xs font-medium text-zinc-900 truncate mt-0.5">{user?.full_name}</div>
          <div className="text-[11px] text-zinc-500 truncate">{user?.email}</div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`w-full text-left px-3 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap truncate ${
                  active
                    ? 'bg-purple-800 text-white'
                    : 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-zinc-200 space-y-1">
          <button
            type="button"
            onClick={onGoPublic}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 rounded-md cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Public Marketplace</span>
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 rounded-md cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setMobileMenuOpen(false)} />
          <aside className="relative z-10 w-64 bg-white h-full flex flex-col border-r border-zinc-200">
            <div className="h-14 px-4 border-b border-zinc-200 flex items-center justify-between">
              <span className="font-display text-sm font-semibold text-zinc-900">{roleLabel}</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-zinc-600 cursor-pointer"
                aria-label="Close navigation"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onTabChange(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs font-medium rounded-md cursor-pointer ${
                    activeTab === item.id ? 'bg-purple-800 text-white' : 'text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
            <div className="p-3 border-t border-zinc-200 space-y-1">
              <button
                type="button"
                onClick={onGoPublic}
                className="w-full text-left px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 rounded-md cursor-pointer"
              >
                Public Marketplace
              </button>
              <button
                type="button"
                onClick={() => void logout()}
                className="w-full text-left px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 rounded-md cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Portal Top Bar */}
        <header className="no-print sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-sm border-b border-zinc-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 border border-zinc-200 rounded-md text-zinc-700 cursor-pointer"
              aria-label="Open menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <span className="text-xs sm:text-sm font-semibold text-zinc-900 truncate">
              {navItems.find((i) => i.id === activeTab)?.label || 'Dashboard'}
            </span>
          </div>

          {onGlobalSearchChange && (
            <div className="hidden sm:block relative w-64 lg:w-80">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => onGlobalSearchChange(e.target.value)}
                placeholder="Search workspace records..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-zinc-300 rounded-md bg-zinc-50 focus:bg-white focus:outline-none focus:border-purple-700"
              />
            </div>
          )}

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setNotifOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 rounded-md text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer whitespace-nowrap"
            >
              <Bell className="w-3.5 h-3.5 text-purple-800" aria-hidden="true" />
              <span>Alerts</span>
              {unreadNotifications > 0 && (
                <span className="font-mono-tabular font-semibold text-purple-800">({unreadNotifications})</span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-zinc-200 rounded-lg shadow-lg z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-900">Notifications</span>
                  <button
                    type="button"
                    onClick={() => void markAllNotificationsRead()}
                    className="text-xs text-purple-800 hover:underline cursor-pointer"
                  >
                    Mark all read
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-xs text-zinc-500">No notifications yet.</div>
                  ) : (
                    notifications.slice(0, 12).map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          setNotifOpen(false);
                          if (n.link_tab && navItems.some((i) => i.id === n.link_tab)) {
                            onTabChange(n.link_tab);
                          }
                        }}
                        className={`w-full text-left p-3.5 hover:bg-zinc-50 cursor-pointer ${
                          n.is_read === 0 ? 'bg-purple-50/40' : ''
                        }`}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-xs font-semibold text-zinc-900">{n.title}</span>
                          <span className="text-[11px] text-zinc-400 shrink-0">{formatDateTime(n.created_at)}</span>
                        </div>
                        <p className="text-xs text-zinc-600 mt-0.5 leading-relaxed">{n.message}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
