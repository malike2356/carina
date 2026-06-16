import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, setToken } from '../api/client';

export function RegisterPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError('');
    const form = new FormData(e.currentTarget);
    try {
      const data = await api<{ token: string }>('/api/cloud/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          email: form.get('email'),
          password: form.get('password'),
        }),
      });
      setToken(data.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <div className="w-full rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Create account</h1>
        <p className="mt-1 text-sm text-slate-600">Free workspace first, then Scout when the workflow becomes client-facing.</p>
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p className="font-medium text-slate-900">Install Carina to build the habit.</p>
          <p className="mt-1">When you need audit logs, team controls, or SOC2-ready security, Scout becomes the paid next step.</p>
        </div>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <input name="name" required placeholder="Name" className="w-full rounded-md border border-slate-300 px-3 py-2" />
          <input name="email" type="email" required placeholder="Email" className="w-full rounded-md border border-slate-300 px-3 py-2" />
          <input name="password" type="password" minLength={8} required placeholder="Password" className="w-full rounded-md border border-slate-300 px-3 py-2" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={pending} className="w-full rounded-md bg-slate-900 px-4 py-2 text-white disabled:opacity-50">
            {pending ? 'Creating...' : 'Create account'}
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-600">
          Already registered? <Link to="/login" className="font-medium text-slate-900">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
