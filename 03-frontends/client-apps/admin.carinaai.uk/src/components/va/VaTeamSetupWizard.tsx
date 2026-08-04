'use client';

import { useState } from 'react';

export interface VaTeamSetupWizardProps {
  onComplete: () => void;
}

type WizardStep = 1 | 2 | 3;

export function VaTeamSetupWizard({ onComplete }: VaTeamSetupWizardProps) {
  const [step, setStep] = useState<WizardStep>(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [maxLoad, setMaxLoad] = useState('5');
  const [addedName, setAddedName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName || !trimmedEmail) {
      setError('Name and email are required.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/admin/va/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          maxLoad: parseInt(maxLoad, 10) || 5,
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? 'Could not add team member.');
        return;
      }
      setAddedName(trimmedName);
      setStep(3);
    } catch {
      setError('Could not add team member. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg rounded-lg border border-border bg-elevated p-8">
      {step === 1 ? (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Add your first team member</h2>
            <p className="mt-3 text-sm leading-relaxed text-text-muted">
              When your Aiva cannot help a customer, it hands the conversation to a real person on
              your team. Before that can happen, you need to add at least one person here.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStep(2)}
            className="btn-admin-primary"
          >
            Add someone now
          </button>
        </div>
      ) : null}

      {step === 2 ? (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Add your first team member</h2>
          </div>

          <div className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm text-text-primary">Their name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. James"
                required
                className="admin-input w-full"
                autoComplete="name"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm text-text-primary">Their email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. james@yourcompany.com"
                required
                className="admin-input w-full"
                autoComplete="email"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm text-text-primary">
                How many conversations can they handle at once?
              </span>
              <input
                type="number"
                min={1}
                max={20}
                value={maxLoad}
                onChange={(e) => setMaxLoad(e.target.value)}
                className="admin-input w-full"
              />
              <p className="text-xs text-text-muted">
                We suggest starting with 5. You can change this any time.
              </p>
            </label>
          </div>

          {error ? <p className="text-sm text-danger">{error}</p> : null}

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={submitting} className="btn-admin-primary">
              {submitting ? 'Adding...' : 'Add them'}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setError('');
                setStep(1);
              }}
              className="text-sm text-text-muted hover:text-text-primary"
            >
              Back
            </button>
          </div>
        </form>
      ) : null}

      {step === 3 ? (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Ready.</h2>
            <p className="mt-3 text-sm leading-relaxed text-text-muted">
              {addedName} has been added. When your Aiva needs help, it will notify {addedName}{' '}
              directly.
            </p>
          </div>
          <button type="button" onClick={onComplete} className="btn-admin-primary">
            Go to the queue
          </button>
        </div>
      ) : null}
    </div>
  );
}
