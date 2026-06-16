import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, setToken } from '../api/client';

export function LoginPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError('');
    const form = new FormData(e.currentTarget);
    try {
      const data = await api<{ token: string }>('/api/cloud/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: form.get('email'),
          password: form.get('password'),
        }),
      });
      setToken(data.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <div className="w-full rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-slate-600">Start with Carina, then add Scout when client data and audit trails matter.</p>
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p className="font-medium text-slate-900">Carina is the vehicle.</p>
          <p className="mt-1">Scout is the paid destination for security, governance, and enterprise readiness.</p>
          <a
            href="https://labyrinthscout.com/pricing"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex font-medium text-slate-900 underline underline-offset-2"
          >
            See Scout plans
          </a>
        </div>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <input name="email" type="email" required placeholder="Email" className="w-full rounded-md border border-slate-300 px-3 py-2" />
          <input name="password" type="password" required placeholder="Password" className="w-full rounded-md border border-slate-300 px-3 py-2" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={pending} className="w-full rounded-md bg-slate-900 px-4 py-2 text-white disabled:opacity-50">
            {pending ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-600">
          No account? <Link to="/register" className="font-medium text-slate-900">Register</Link>
        </p>
      </div>
    </div>
  );
}
