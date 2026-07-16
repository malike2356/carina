import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api/client';

type ScoutStatus = {
  paired: boolean;
  plan: string;
  consoleUrl?: string;
  canPair: boolean;
};

export function ScoutPage() {
  const [status, setStatus] = useState<ScoutStatus | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function load() {
    const data = await api<ScoutStatus>('/api/cloud/scout/status');
    setStatus(data);
  }

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load Scout status'));
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError('');
    const form = new FormData(e.currentTarget);
    try {
      await api('/api/cloud/scout/pair', {
        method: 'POST',
        body: JSON.stringify({
          consoleUrl: form.get('consoleUrl'),
          apiKey: form.get('apiKey'),
        }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pairing failed');
    } finally {
      setPending(false);
    }
  }

  if (!status) {
    return <p className="text-sm text-slate-600">Loading Scout status...</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Labyrinth Scout</h1>
        <p className="text-sm text-slate-600">This is the control layer that governs a Carina workflow once it reaches production.</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">
          Carina drives adoption. Scout adds the controls businesses need for audit logs, trust, approvals, and safe deployment.
        </p>
        <a
          href="https://labyrinthscout.com/pricing"
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex text-sm font-medium text-slate-900 underline underline-offset-2"
        >
          View Scout pricing
        </a>
      </div>
      {!status.canPair && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Upgrade to Team to pair Scout. That is the point where the workflow moves from workspace into governed production.
        </div>
      )}
      {status.paired ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="inline-flex rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
            Scout connected
          </p>
          <p className="mt-3 text-sm text-slate-600">Carina is now attached to the production control layer.</p>
          {status.consoleUrl && (
            <p className="mt-4 text-sm">
              Console: <a className="font-medium text-slate-900" href={status.consoleUrl} target="_blank" rel="noreferrer">{status.consoleUrl}</a>
            </p>
          )}
        </div>
      ) : status.canPair ? (
        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">Pair Carina to Scout so the workspace you already use starts reporting security events, trust data, and approvals.</p>
          <input name="consoleUrl" required placeholder="Scout console URL" className="w-full rounded-md border border-slate-300 px-3 py-2" />
          <input name="apiKey" type="password" required placeholder="Scout API key" className="w-full rounded-md border border-slate-300 px-3 py-2" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={pending} className="rounded-md bg-slate-900 px-4 py-2 text-white disabled:opacity-50">
            {pending ? 'Pairing...' : 'Pair Scout'}
          </button>
        </form>
      ) : null}
    </div>
  );
}
