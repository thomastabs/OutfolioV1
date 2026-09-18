'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BackButton } from '@/app/components/ui/back-button';
import { useSession } from '../session-context';
import { LoginForm } from './LoginForm';

export default function LoginPage() {
  const router = useRouter();
  const { status, update } = useSession();

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/profile');
    }
  }, [router, status]);

  async function handleLoggedIn() {
    await update();
    router.replace('/profile');
  }

  if (status === 'loading') {
    return <p>Checking your session...</p>;
  }

  return (
    <main className="page-shell auth-page">
      <BackButton />
      <h1>Log in to Outfolio</h1>
      <LoginForm onLoggedIn={handleLoggedIn} />
    </main>
  );
}
