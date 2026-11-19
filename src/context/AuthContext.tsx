import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { apiFetch, getStoredSessionToken, setStoredSessionToken } from '../lib/api';
import type { AuthUser, NotificationItem } from '../types/platform';

export interface BootstrapIntegrations {
  database: string;
  realtime: string;
  firebaseProvisioned: boolean;
  seedSuperAdminConfigured?: boolean;
  sessionSecretConfigured?: boolean;
  emailDeliveryConfigured: boolean;
  razorpayConfigured: boolean;
  whatsappConfigured: boolean;
}

interface RealtimeListener {
  (event: { type: string; payload: unknown }): void;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  needsSuperAdminSetup: boolean;
  integrations: BootstrapIntegrations | null;
  notifications: NotificationItem[];
  unreadNotifications: number;
  applyAuthSession: (authUser: AuthUser, sessionToken?: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshBootstrapStatus: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  logout: () => Promise<void>;
  subscribeRealtime: (fn: RealtimeListener) => () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsSuperAdminSetup, setNeedsSuperAdminSetup] = useState(false);
  const [integrations, setIntegrations] = useState<BootstrapIntegrations | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const listenersRef = useRef(new Set<RealtimeListener>());
  const wsRef = useRef<WebSocket | null>(null);

  const refreshNotifications = useCallback(async () => {
    try {
      const data = await apiFetch<{ notifications: NotificationItem[] }>('/api/notifications');
      setNotifications(data.notifications);
    } catch {
      // Ignore if unauthenticated
    }
  }, []);

  const refreshBootstrapStatus = useCallback(async () => {
    try {
      const statusData = await apiFetch<{
        needsSuperAdminSetup: boolean;
        integrations: BootstrapIntegrations;
      }>('/api/auth/bootstrap-status');
      setNeedsSuperAdminSetup(statusData.needsSuperAdminSetup);
      setIntegrations(statusData.integrations);
    } catch {
      // Handled gracefully
    }
  }, []);

  const applyAuthSession = useCallback(
    async (authUser: AuthUser, sessionToken?: string) => {
      if (sessionToken) {
        setStoredSessionToken(sessionToken);
      }
      setUser(authUser);
      setLoading(false);
      await Promise.all([refreshBootstrapStatus(), refreshNotifications()]);
    },
    [refreshBootstrapStatus, refreshNotifications]
  );

  const refreshUser = useCallback(async () => {
    try {
      const [meData, statusData] = await Promise.all([
        apiFetch<{ user: AuthUser | null }>('/api/auth/me'),
        apiFetch<{ needsSuperAdminSetup: boolean; integrations: BootstrapIntegrations }>('/api/auth/bootstrap-status'),
      ]);
      setUser(meData.user);
      setNeedsSuperAdminSetup(statusData.needsSuperAdminSetup);
      setIntegrations(statusData.integrations);
      if (meData.user) {
        await refreshNotifications();
      } else {
        setStoredSessionToken(null);
        setNotifications([]);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [refreshNotifications]);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  // Connect authenticated WebSocket for real-time messages & notifications
  useEffect(() => {
    if (!user) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    let closedIntentionally = false;
    let reconnectTimer: number | undefined;

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const token = getStoredSessionToken();
      const wsUrl = token
        ? `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`
        : `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (evt) => {
        try {
          const parsed = JSON.parse(String(evt.data)) as { type: string; payload: unknown };
          if (parsed.type === 'notification:new' && parsed.payload) {
            const ntf = parsed.payload as NotificationItem;
            setNotifications((prev) => (prev.some((p) => p.id === ntf.id) ? prev : [ntf, ...prev]));
          }
          for (const listener of listenersRef.current) {
            listener(parsed);
          }
        } catch {
          // Ignore malformed packet
        }
      };

      ws.onclose = () => {
        if (!closedIntentionally) {
          reconnectTimer = window.setTimeout(connect, 3000);
        }
      };
    };

    connect();

    return () => {
      closedIntentionally = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [user]);

  const markAllNotificationsRead = useCallback(async () => {
    await apiFetch('/api/notifications/read-all', { method: 'PATCH' });
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setStoredSessionToken(null);
      setUser(null);
      setNotifications([]);
    }
  }, []);

  const subscribeRealtime = useCallback((fn: RealtimeListener) => {
    listenersRef.current.add(fn);
    return () => {
      listenersRef.current.delete(fn);
    };
  }, []);

  const unreadNotifications = notifications.filter((n) => n.is_read === 0).length;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        needsSuperAdminSetup,
        integrations,
        notifications,
        unreadNotifications,
        applyAuthSession,
        refreshUser,
        refreshBootstrapStatus,
        refreshNotifications,
        markAllNotificationsRead,
        logout,
        subscribeRealtime,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
