import Link from 'next/link';
import { ChangePasswordSettings } from '@/components/settings/ChangePasswordSettings';

export default function PasswordSettingsPage() {
  return (
    <main className="mx-auto max-w-[90rem] space-y-8 px-6 py-10">
      <div>
        <p className="text-sm text-text-muted">
          <Link href="/settings?section=account" className="text-accent underline">
            Settings
          </Link>
          {' / '}
          <span>Account</span>
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Password</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Change your sign-in password while logged in, or request a reset link by email.
        </p>
      </div>

      <ChangePasswordSettings />
    </main>
  );
}
