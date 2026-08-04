'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function AdminSignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSignOut() {
    setPending(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onSignOut}
      disabled={pending}
      className="text-xs text-text-muted hover:text-text-primary disabled:opacity-50"
    >
      {pending ? 'Signing out...' : 'Sign out'}
    </button>
  );
}
