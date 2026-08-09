'use client';

import { useState } from 'react';
import { saveByokKey } from '@/lib/actions';
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

const PROVIDERS = ['deepseek', 'openai', 'anthropic', 'gemini', 'groq', 'openrouter', 'tavily'];

export function AddKeyDialog() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    try {
      const formData = new FormData(e.currentTarget);
      await saveByokKey(formData);
      setOpen(false);
      e.currentTarget.reset();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add provider key</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add BYOK provider key</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="provider">Provider</Label>
            <select
              id="provider"
              name="provider"
              className="flex h-10 w-full rounded-md border border-border bg-elevated px-3 text-sm text-text-primary"
              required
            >
              {PROVIDERS.map((provider) => (
                <option key={provider} value={provider}>{provider}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="apiKey">API key</Label>
            <Input id="apiKey" name="apiKey" type="password" autoComplete="off" required />
          </div>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? 'Saving...' : 'Save key'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
