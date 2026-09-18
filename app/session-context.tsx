'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

export type SessionUser = {
  userId: string;
  username: string;
  email: string;
};

type SessionContextValue = {
  status: SessionStatus;
  data: { user: SessionUser } | null;
  update: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

async function fetchSessionUser(): Promise<SessionUser | null> {
  try {
    const response = await fetch('/api/v1/auth/session');

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as SessionUser;
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);

  const refresh = useCallback(async () => {
    const sessionUser = await fetchSessionUser();
    setUser(sessionUser);
    setStatus(sessionUser ? 'authenticated' : 'unauthenticated');
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo<SessionContextValue>(
    () => ({
      status,
      data: user ? { user } : null,
      update: refresh,
    }),
    [status, user, refresh],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }

  return context;
}
