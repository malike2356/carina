import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api/client';

type Org = { id: string; name: string; email: string; plan: string };

export function DashboardPage() {
  const [org, setOrg] = useState<Org | null>(null);
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    void api<{ org: Org }>('/api/cloud/auth/me').then((data) => setOrg(data.org));
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setReply('');
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('carina_cloud_token') ?? ''}`,
        },
        body: JSON.stringify({ message, sessionId: 'cloud-dashboard' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Chat failed' }));
        throw new Error(String(body.error ?? 'Chat failed'));
      }
      const data = await res.json() as { reply?: string };
      setReply(data.reply ?? 'No reply');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat failed');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{org?.name ?? 'Workspace'}</h1>
        <p className="text-sm text-slate-600">Plan: {org?.plan ?? 'loading...'}</p>
        <p className="mt-1 text-sm text-slate-600">Carina is the daily workspace. Scout is the paid control layer when the work needs to survive a client review.</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Add BYOK keys before chatting. If the account grows into client work, open Security to connect Scout.</p>
        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            placeholder="Ask Carina..."
          />
          <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-white">Send</button>
        </form>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {reply && <pre className="mt-4 whitespace-pre-wrap rounded-md bg-slate-50 p-4 text-sm">{reply}</pre>}
      </div>
    </div>
  );
}
