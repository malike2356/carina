'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

interface CustomDomainRow {
  hostname: string;
  cnameTarget: string;
  cfOwnershipVerificationName: string | null;
  cfOwnershipVerificationValue: string | null;
}

interface ProvisionResult {
  workspaceId: string;
  loginUrl: string;
  customDomainRow?: CustomDomainRow | null;
}

interface ProvisionCustomerModalProps {
  open: boolean;
  onClose: () => void;
  onProvisioned: () => void;
}

export function ProvisionCustomerModal({ open, onClose, onProvisioned }: ProvisionCustomerModalProps) {
  const { push: toast } = useToast();
  const [email, setEmail] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ProvisionResult | null>(null);

  function resetForm() {
    setEmail('');
    setWorkspaceName('');
    setCustomDomain('');
    setSendWelcomeEmail(true);
    setError('');
    setResult(null);
  }

  function handleClose() {
    if (busy) return;
    resetForm();
    onClose();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin/provision-business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          workspaceName: workspaceName.trim(),
          customDomain: customDomain.trim() || undefined,
          sendWelcomeEmail,
        }),
      });
      const body = (await res.json()) as ProvisionResult & { error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Provisioning failed');
      setResult({
        workspaceId: body.workspaceId,
        loginUrl: body.loginUrl,
        customDomainRow: body.customDomainRow ?? null,
      });
      toast('Business workspace provisioned', 'success');
      onProvisioned();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Provisioning failed';
      setError(message);
      toast(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function copyText(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast(`${label} copied`, 'info');
    } catch {
      toast(`Could not copy ${label.toLowerCase()}`, 'error');
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={result ? 'Workspace provisioned' : 'Provision customer'}
      description={
        result
          ? 'Share the login link with the customer. DNS steps apply if a custom domain was added.'
          : 'Create a Business trial workspace (30 days). The customer receives account access by email when enabled.'
      }
      wide
      footer={
        result ? (
          <>
            <button
              type="button"
              onClick={() => {
                resetForm();
              }}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary hover:bg-overlay"
            >
              Provision another
            </button>
            <Link
              href={`/customers/${result.workspaceId}`}
              className="btn-admin-primary text-sm"
              onClick={handleClose}
            >
              View customer
            </Link>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={handleClose}
              disabled={busy}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary hover:bg-overlay disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="provision-customer-form"
              disabled={busy || !email.trim() || !workspaceName.trim()}
              className="btn-admin-primary text-sm disabled:opacity-50"
            >
              {busy ? 'Provisioning...' : 'Provision workspace'}
            </button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-4 text-sm">
          <div>
            <p className="text-xs text-text-muted">Workspace ID</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 truncate rounded border border-border bg-surface px-2 py-1.5 font-mono text-xs text-text-primary">
                {result.workspaceId}
              </code>
              <button
                type="button"
                onClick={() => void copyText('Workspace ID', result.workspaceId)}
                className="rounded border border-border px-2 py-1.5 text-xs text-text-secondary hover:bg-overlay"
              >
                Copy
              </button>
            </div>
          </div>
          <div>
            <p className="text-xs text-text-muted">Login URL</p>
            <div className="mt-1 flex items-start gap-2">
              <code className="max-h-24 flex-1 overflow-auto break-all rounded border border-border bg-surface px-2 py-1.5 font-mono text-xs text-text-primary">
                {result.loginUrl}
              </code>
              <button
                type="button"
                onClick={() => void copyText('Login URL', result.loginUrl)}
                className="shrink-0 rounded border border-border px-2 py-1.5 text-xs text-text-secondary hover:bg-overlay"
              >
                Copy
              </button>
            </div>
          </div>
          {result.customDomainRow ? (
            <div className="rounded-lg border border-border bg-surface p-3 space-y-2">
              <p className="text-xs font-medium text-text-primary">Custom domain DNS</p>
              <p className="text-xs text-text-secondary">
                Hostname: <span className="text-text-primary">{result.customDomainRow.hostname}</span>
              </p>
              <p className="text-xs text-text-muted">CNAME target</p>
              <code className="block break-all rounded border border-border bg-elevated px-2 py-1.5 font-mono text-xs text-text-primary">
                {result.customDomainRow.cnameTarget}
              </code>
              {result.customDomainRow.cfOwnershipVerificationName &&
              result.customDomainRow.cfOwnershipVerificationValue ? (
                <>
                  <p className="text-xs text-text-muted">Cloudflare ownership TXT</p>
                  <code className="block break-all rounded border border-border bg-elevated px-2 py-1.5 font-mono text-xs text-text-primary">
                    {result.customDomainRow.cfOwnershipVerificationName} ={' '}
                    {result.customDomainRow.cfOwnershipVerificationValue}
                  </code>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <form id="provision-customer-form" onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {error ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">
              {error}
            </p>
          ) : null}
          <label className="block text-sm">
            <span className="text-text-secondary">Email address</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="off"
              className="admin-input mt-1"
              placeholder="customer@company.com"
            />
          </label>
          <label className="block text-sm">
            <span className="text-text-secondary">Workspace / company name</span>
            <input
              type="text"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              required
              className="admin-input mt-1"
              placeholder="Acme Ltd"
            />
          </label>
          <label className="block text-sm">
            <span className="text-text-secondary">Custom domain (optional)</span>
            <input
              type="text"
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              className="admin-input mt-1"
              placeholder="aiva.example.com"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={sendWelcomeEmail}
              onChange={(e) => setSendWelcomeEmail(e.target.checked)}
              className="rounded border-border"
            />
            Send welcome email with login link and DNS instructions
          </label>
        </form>
      )}
    </Modal>
  );
}
