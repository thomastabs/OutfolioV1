'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { SessionProvider, useSession } from './session-context';

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <SessionPersistenceGuard>{children}</SessionPersistenceGuard>
    </SessionProvider>
  );
}

const protectedPathPrefixes = ['/profile', '/projects'];
const authPaths = ['/login', '/register'];

function SessionPersistenceGuard({ children }: ProvidersProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { status, update } = useSession();

  useEffect(() => {
    const isProtectedPath = protectedPathPrefixes.some((prefix) => pathname.startsWith(prefix));

    if (status === 'unauthenticated' && isProtectedPath) {
      router.replace('/login');
      return;
    }

    if (status !== 'authenticated' || !isProtectedPath) return;

    let isActive = true;

    async function validateBackendSession() {
      try {
        const response = await fetch('/api/v1/auth/session');

        if (!isActive) return;

        if (!response.ok) {
          await fetch('/api/v1/auth/logout', { method: 'POST' }).catch(() => undefined);
          await update();
          router.replace('/login');
        }
      } catch {
        if (isActive && isProtectedPath) {
          await update();
          router.replace('/login');
        }
      }
    }

    validateBackendSession();

    return () => {
      isActive = false;
    };
  }, [pathname, router, status, update]);

  useEffect(() => {
    if (status === 'authenticated' && authPaths.includes(pathname)) {
      router.replace('/profile');
    }
  }, [pathname, router, status]);

  return <>{children}</>;
}
