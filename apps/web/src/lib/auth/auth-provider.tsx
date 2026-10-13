'use client';

import type { AuthResponse, User } from '@expense/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import * as React from 'react';
import { refreshSession, setAccessToken, setSessionExpiredHandler } from '@/lib/api/client';
import { authApi } from '@/lib/api/endpoints';

type Status = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: Status;
  user: User | null;
  login: (email: string, password: string) => Promise<User>;
  register: (input: { name: string; email: string; password: string }) => Promise<User>;
  logout: () => Promise<void>;
  /** Applies a fresh auth response (e.g. after a password change). */
  applySession: (response: AuthResponse) => void;
  setUser: (user: User) => void;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

function hasSessionHint() {
  return (
    typeof document !== 'undefined' && document.cookie.split('; ').some((c) => c === 'et_session=1')
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<Status>('loading');
  const [user, setUserState] = React.useState<User | null>(null);
  const queryClient = useQueryClient();
  const router = useRouter();
  const { setTheme } = useTheme();

  const setUser = React.useCallback(
    (next: User) => {
      setUserState(next);
      setTheme(next.theme);
    },
    [setTheme],
  );

  const applySession = React.useCallback(
    (response: AuthResponse) => {
      setAccessToken(response.accessToken);
      setUser(response.user);
      setStatus('authenticated');
    },
    [setUser],
  );

  const clearSession = React.useCallback(() => {
    setAccessToken(null);
    setUserState(null);
    setStatus('unauthenticated');
    queryClient.clear();
  }, [queryClient]);

  // Restore the session from the refresh cookie on first load.
  React.useEffect(() => {
    let cancelled = false;
    const restore = hasSessionHint() ? refreshSession() : Promise.resolve(null);
    restore.then((response) => {
      if (cancelled) return;
      if (response) applySession(response);
      else clearSession();
    });
    return () => {
      cancelled = true;
    };
  }, [applySession, clearSession]);

  // When a refresh fails mid-session, sign out and return to the login page.
  React.useEffect(() => {
    setSessionExpiredHandler(() => {
      clearSession();
      const next = window.location.pathname + window.location.search;
      router.replace(`/login?next=${encodeURIComponent(next)}&expired=1`);
    });
    return () => setSessionExpiredHandler(null);
  }, [clearSession, router]);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      applySession,
      setUser,
      login: async (email, password) => {
        const response = await authApi.login({ email, password });
        applySession(response);
        return response.user;
      },
      register: async (input) => {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const response = await authApi.register({ ...input, timezone });
        applySession(response);
        return response.user;
      },
      logout: async () => {
        try {
          await authApi.logout();
        } finally {
          clearSession();
          router.replace('/login');
        }
      },
    }),
    [status, user, applySession, setUser, clearSession, router],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** The signed-in user. Only call inside the authenticated app shell. */
export function useUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error('useUser called without an authenticated user');
  return user;
}
