import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api/client';

type KeyRow = {
  id: string;
  provider: string;
  keyName: string;
  maskedValue: string;
};

export function KeysPage() {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function load() {
    const data = await api<{ keys: KeyRow[] }>('/api/cloud/keys');
    setKeys(data.keys);
  }

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load keys'));
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError('');
    const form = new FormData(e.currentTarget);
    try {
      await api('/api/cloud/keys', {
        method: 'POST',
        body: JSON.stringify({
          provider: form.get('provider'),
          keyName: form.get('keyName'),
          apiKey: form.get('apiKey'),
        }),
      });
      e.currentTarget.reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save key');
    } finally {
      setPending(false);
    }
  }

  async function remove(id: string) {
    setError('');
    try {
      await api(`/api/cloud/keys/${id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete key');
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">BYOK keys</h1>
        <p className="text-sm text-slate-600">Keys are encrypted at rest. Only masked values are shown.</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <input name="provider" required placeholder="Provider (gemini, deepseek, openai, ...)" className="w-full rounded-md border border-slate-300 px-3 py-2" />
        <input name="keyName" placeholder="Key label" className="w-full rounded-md border border-slate-300 px-3 py-2" />
        <input name="apiKey" type="password" required placeholder="API key" className="w-full rounded-md border border-slate-300 px-3 py-2" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={pending} className="rounded-md bg-slate-900 px-4 py-2 text-white disabled:opacity-50">
          {pending ? 'Saving...' : 'Add key'}
        </button>
      </form>
      <div className="space-y-3">
        {keys.length === 0 ? (
          <p className="text-sm text-slate-500">No keys yet.</p>
        ) : (
          keys.map((key) => (
            <div key={key.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div>
                <p className="font-medium capitalize">{key.provider}</p>
                <p className="text-sm text-slate-500">{key.keyName} | {key.maskedValue}</p>
              </div>
              <button type="button" onClick={() => void remove(key.id)} className="text-sm text-red-600">Remove</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
