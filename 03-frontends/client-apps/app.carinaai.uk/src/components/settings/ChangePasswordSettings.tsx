'use client';

import { useEffect, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type AccountPasswordState = {
  email: string;
  hasPassword: boolean;
};

export function ChangePasswordSettings() {
  const [account, setAccount] = useState<AccountPasswordState | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(true);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(false);
  const [formError, setFormError] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [formPending, setFormPending] = useState(false);

  const [emailError, setEmailError] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailPending, setEmailPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/account/password', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load account');
        return response.json() as Promise<AccountPasswordState>;
      })
      .then((data) => {
        if (!cancelled) setAccount(data);
      })
      .catch(() => {
        if (!cancelled) setFormError('Could not load your account details.');
      })
      .finally(() => {
        if (!cancelled) setLoadingAccount(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onChangePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormPending(true);
    setFormError('');
    setFormMessage('');

    try {
      const response = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: account?.hasPassword ? currentPassword : undefined,
          newPassword,
          confirmPassword,
          revokeOtherSessions,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      if (!response.ok) {
        throw new Error(data.error ?? 'Could not update password');
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setRevokeOtherSessions(false);
      setAccount((current) => (current ? { ...current, hasPassword: true } : current));
      setFormMessage('Password updated successfully.');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not update password');
    } finally {
      setFormPending(false);
    }
  }

  async function onSendResetLink() {
    if (!account?.email) return;
    setEmailPending(true);
    setEmailError('');
    setEmailMessage('');

    const redirectTo = `${window.location.origin}/reset-password`;
    const result = await authClient.requestPasswordReset({
      email: account.email,
      redirectTo,
    });

    if (result.error) {
      setEmailError(result.error.message ?? 'Could not send reset email');
      setEmailPending(false);
      return;
    }

    setEmailMessage('If this email exists in our system, check your inbox for a reset link.');
    setEmailPending(false);
  }

  if (loadingAccount) {
    return <p className="text-sm text-text-muted">Loading account...</p>;
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-sm font-medium text-text-primary">
          {account?.hasPassword ? 'Change password' : 'Set a password'}
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          {account?.hasPassword
            ? 'Update your sign-in password. You stay signed in on this device unless you choose to sign out elsewhere.'
            : 'Add a password so you can sign in with email as well as any connected SSO provider.'}
        </p>

        <form onSubmit={onChangePassword} className="mt-4 space-y-4">
          {account?.hasPassword ? (
            <div className="space-y-2">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              minLength={10}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              minLength={10}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </div>

          {account?.hasPassword ? (
            <label className="flex items-start gap-3 text-sm text-text-secondary">
              <input
                type="checkbox"
                className="mt-1"
                checked={revokeOtherSessions}
                onChange={(event) => setRevokeOtherSessions(event.target.checked)}
              />
              <span>Sign out all other devices after changing my password</span>
            </label>
          ) : null}

          {formError ? <p className="text-sm text-danger">{formError}</p> : null}
          {formMessage ? <p className="text-sm text-accent">{formMessage}</p> : null}

          <Button type="submit" disabled={formPending}>
            {formPending ? 'Saving...' : account?.hasPassword ? 'Update password' : 'Set password'}
          </Button>
        </form>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-sm font-medium text-text-primary">Reset via email</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Prefer a link in your inbox? We will email a secure reset link to{' '}
          <span className="font-medium text-text-primary">{account?.email ?? 'your account email'}</span>.
          Use this if you forgot your current password.
        </p>

        {emailError ? <p className="mt-3 text-sm text-danger">{emailError}</p> : null}
        {emailMessage ? <p className="mt-3 text-sm text-accent">{emailMessage}</p> : null}

        <Button className="mt-4" variant="outline" onClick={onSendResetLink} disabled={emailPending || !account?.email}>
          {emailPending ? 'Sending link...' : 'Send reset link to my email'}
        </Button>
      </section>
    </div>
  );
}
