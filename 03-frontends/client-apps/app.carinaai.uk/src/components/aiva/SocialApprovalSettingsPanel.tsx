'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type SocialSettings = {
  socialRequireApproval: boolean;
  socialAutoReplyEnabled: boolean;
  socialAutoReplyAllowlist: string[];
};

const EMPTY: SocialSettings = {
  socialRequireApproval: false,
  socialAutoReplyEnabled: false,
  socialAutoReplyAllowlist: [],
};

export function SocialApprovalSettingsPanel({ className }: { className?: string }) {
  const [settings, setSettings] = useState<SocialSettings>(EMPTY);
  const [allowlistText, setAllowlistText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/workspace/social-settings');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Could not load approval settings');
        return;
      }
      const next = (data.settings ?? EMPTY) as SocialSettings;
      setSettings({
        socialRequireApproval: Boolean(next.socialRequireApproval),
        socialAutoReplyEnabled: Boolean(next.socialAutoReplyEnabled),
        socialAutoReplyAllowlist: Array.isArray(next.socialAutoReplyAllowlist)
          ? next.socialAutoReplyAllowlist.map(String)
          : [],
      });
      setAllowlistText(
        (Array.isArray(next.socialAutoReplyAllowlist) ? next.socialAutoReplyAllowlist : [])
          .map(String)
          .join('\n'),
      );
    } catch {
      setError('Could not load approval settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(patch?: Partial<SocialSettings>) {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const allowlist = (patch?.socialAutoReplyAllowlist
        ?? allowlistText
          .split(/[\n,]+/)
          .map((row) => row.trim())
          .filter(Boolean));
      const body = {
        socialRequireApproval: patch?.socialRequireApproval ?? settings.socialRequireApproval,
        socialAutoReplyEnabled: patch?.socialAutoReplyEnabled ?? settings.socialAutoReplyEnabled,
        socialAutoReplyAllowlist: allowlist,
      };
      const res = await fetch('/api/workspace/social-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Could not save');
        return;
      }
      const next = (data.settings ?? body) as SocialSettings;
      setSettings({
        socialRequireApproval: Boolean(next.socialRequireApproval),
        socialAutoReplyEnabled: Boolean(next.socialAutoReplyEnabled),
        socialAutoReplyAllowlist: Array.isArray(next.socialAutoReplyAllowlist)
          ? next.socialAutoReplyAllowlist.map(String)
          : allowlist,
      });
      setAllowlistText(
        (Array.isArray(next.socialAutoReplyAllowlist)
          ? next.socialAutoReplyAllowlist
          : allowlist
        ).map(String).join('\n'),
      );
      setNotice('Saved');
    } catch {
      setError('Could not save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className={cn('rounded-xl border border-border bg-surface px-4 py-6', className)}>
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading approval settings...
        </div>
      </div>
    );
  }

  return (
    <section className={cn('rounded-xl border border-border bg-surface p-4', className)}>
      <div className="flex items-start gap-2">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-text-primary">Send approval policy</h2>
          <p className="mt-1 text-[11px] text-text-muted">
            Controls whether email/messaging drafts wait here, and which email senders can auto-send.
          </p>
        </div>
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-elevated/50 px-3 py-2.5">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={settings.socialRequireApproval}
          disabled={saving}
          onChange={(event) => {
            const next = event.target.checked;
            setSettings((current) => ({ ...current, socialRequireApproval: next }));
            void save({ socialRequireApproval: next });
          }}
        />
        <span>
          <span className="block text-sm font-medium text-text-primary">
            Require approval before sending
          </span>
          <span className="mt-0.5 block text-[11px] text-text-muted">
            On: most drafts wait in Approvals. Off: replies can send live (current default).
          </span>
        </span>
      </label>

      <div className="mt-4">
        <label className="block text-[11px] font-medium text-text-muted">
          Auto-send allowlist (one per line)
          <textarea
            value={allowlistText}
            onChange={(event) => setAllowlistText(event.target.value)}
            rows={4}
            placeholder={'thanks\nok\nboss@acme.com\n@trusted-client.com'}
            className="mt-1 w-full rounded-md border border-border bg-base px-3 py-2 font-mono text-xs text-text-primary outline-none focus:border-accent/50"
          />
        </label>
        <p className="mt-1.5 text-[11px] text-text-muted">
          Plain phrases (thanks, ok) cover short chat auto-replies. Entries with @ are email
          exceptions while approval is on: <code className="text-text-secondary">boss@acme.com</code>{' '}
          or <code className="text-text-secondary">@acme.com</code>.
        </p>
        <Button
          type="button"
          size="sm"
          className="mt-2"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Save allowlist
        </Button>
      </div>

      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
      {notice ? <p className="mt-2 text-xs text-emerald-400">{notice}</p> : null}
    </section>
  );
}
