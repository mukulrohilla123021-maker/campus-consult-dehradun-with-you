import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { testFirestoreConnection } from './lib/firebase';
import { PublicWebsite } from './components/public/PublicWebsite';
import { CustomerDashboard } from './components/portal/CustomerDashboard';
import { ConsultantDashboard } from './components/portal/ConsultantDashboard';
import { AdminAndSuperAdminDashboard } from './components/portal/AdminAndSuperAdminDashboard';

const VIEW_STORAGE_KEY = 'cc_active_view';

function readStoredView(): 'public' | 'portal' {
  try {
    return window.localStorage.getItem(VIEW_STORAGE_KEY) === 'portal' ? 'portal' : 'public';
  } catch {
    return 'public';
  }
}

function saveStoredView(next: 'public' | 'portal'): void {
  try {
    window.localStorage.setItem(VIEW_STORAGE_KEY, next);
  } catch {
    // Ignore when storage is blocked
  }
}

function PlatformShell() {
  const { user, loading } = useAuth();
  const [view, setView] = useState<'public' | 'portal'>(readStoredView);
  const [pendingBookServiceId, setPendingBookServiceId] = useState<string | null>(null);

  const changeView = (next: 'public' | 'portal') => {
    saveStoredView(next);
    setView(next);
  };

  // Automatically reset to public if session expires or user logs out
  useEffect(() => {
    if (!loading && !user && view === 'portal') {
      changeView('public');
    }
  }, [loading, user, view]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F7F9] text-sm text-zinc-600">
        Loading Campus Consult Dehradun...
      </div>
    );
  }

  if (view === 'portal' && user) {
    if (user.role === 'customer') {
      return (
        <CustomerDashboard
          onGoPublic={() => changeView('public')}
          initialBookingServiceId={pendingBookServiceId}
          onClearInitialBooking={() => setPendingBookServiceId(null)}
        />
      );
    }
    if (user.role === 'consultant') {
      return <ConsultantDashboard onGoPublic={() => changeView('public')} />;
    }
    if (user.role === 'admin' || user.role === 'super_admin') {
      return <AdminAndSuperAdminDashboard onGoPublic={() => changeView('public')} />;
    }
  }

  return (
    <PublicWebsite
      onEnterPortal={(serviceId) => {
        if (serviceId) setPendingBookServiceId(serviceId);
        changeView('portal');
      }}
    />
  );
}

export default function App() {
  useEffect(() => {
    void testFirestoreConnection();
  }, []);

  return (
    <AuthProvider>
      <PlatformShell />
    </AuthProvider>
  );
}
