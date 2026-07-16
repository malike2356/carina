'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const SCOPE_OPTIONS = [
  { value: 'session', label: 'Session' },
  { value: 'memory', label: 'Memory' },
  { value: 'skills', label: 'Skills' },
  { value: 'analytics', label: 'Analytics' },
];

interface NewKey {
  id: string;
  label: string;
  rawKey: string;
  keyPrefix: string;
}

export function CreateKeyDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<NewKey | null>(null);
  const [copied, setCopied] = useState(false);

  const [label, setLabel] = useState('');
  const [scopes, setScopes] = useState<string[]>(['session']);
  const [rateLimitRpm, setRateLimitRpm] = useState(60);

  function toggleScope(scope: string) {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch('/api/developer/keys', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ label, scopes, rateLimitRpm }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to create key');
        return;
      }
      setNewKey(data.key as NewKey);
      setLabel('');
      setScopes(['session']);
      setRateLimitRpm(60);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setPending(false);
    }
  }

  async function copyKey() {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey.rawKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function onClose(val: boolean) {
    if (!val) {
      setNewKey(null);
      setError(null);
      setCopied(false);
      router.refresh();
    }
    setOpen(val);
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogTrigger asChild>
        <Button>Create API key</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{newKey ? 'Key created' : 'Create API key'}</DialogTitle>
        </DialogHeader>

        {newKey ? (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Copy this key now. It will not be shown again.
            </p>
            <div className="flex items-center gap-2 rounded-md border border-border bg-elevated p-3">
              <code className="flex-1 break-all text-xs text-text-primary">{newKey.rawKey}</code>
              <Button size="sm" variant="outline" onClick={copyKey}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <Button className="w-full" onClick={() => onClose(false)}>
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dk-label">Label</Label>
              <Input
                id="dk-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Production"
                required
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label>Scopes</Label>
              <div className="flex flex-wrap gap-2">
                {SCOPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleScope(opt.value)}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      scopes.includes(opt.value)
                        ? 'border-accent-primary bg-accent-primary/10 text-text-primary'
                        : 'border-border text-text-secondary hover:border-accent-primary/50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dk-rpm">Rate limit (requests/min)</Label>
              <Input
                id="dk-rpm"
                type="number"
                min={1}
                max={600}
                value={rateLimitRpm}
                onChange={(e) => setRateLimitRpm(Number(e.target.value))}
                required
              />
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <Button type="submit" disabled={pending || scopes.length === 0} className="w-full">
              {pending ? 'Creating...' : 'Create key'}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
