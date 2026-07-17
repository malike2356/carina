'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

export interface DeleteCustomerTarget {
  workspaceId: string;
  name: string;
  ownerEmail: string | null;
  subscriptionStatus: string;
  monthlyAmountPence: number;
}

interface DeleteCustomerModalProps {
  target: DeleteCustomerTarget | null;
  onClose: () => void;
  onDeleted: () => void;
}

function isLikelyTestAccount(email: string | null): boolean {
  if (!email?.trim()) return true;
  return email.endsWith('@example.com') || /(test|debug|signup|terms-test|example\.)/i.test(email);
}

export function DeleteCustomerModal({ target, onClose, onDeleted }: DeleteCustomerModalProps) {
  const { push: toast } = useToast();
  const [ack, setAck] = useState('');
  const [force, setForce] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const open = target !== null;
  const isLikelyTest = target ? isLikelyTestAccount(target.ownerEmail) : false;
  const isActivePaid = target
    ? target.subscriptionStatus === 'active' && Number(target.monthlyAmountPence ?? 0) > 0
    : false;
  const needsForce = isActivePaid && !isLikelyTest;

  function handleClose() {
    if (busy) return;
    setAck('');
    setForce(false);
    setError('');
    onClose();
  }

  async function handlePurge() {
    if (!target) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/workspaces/${target.workspaceId}/purge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmId: target.workspaceId,
          acknowledge: ack,
          force,
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Purge failed');
      toast(`${target.name} purged`, 'success');
      setAck('');
      setForce(false);
      onDeleted();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Purge failed';
      setError(message);
      toast(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const canPurge = ack === 'PURGE' && (!needsForce || force) && !busy;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Delete customer"
      description={
        target
          ? `Permanently purge ${target.name}. This deletes its Aivas, billing rows, and cloud login so the owner cannot sign in again.`
          : ''
      }
      footer={
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
            type="button"
            onClick={() => void handlePurge()}
            disabled={!canPurge}
            className="btn-admin-danger text-sm disabled:opacity-50"
          >
            {busy ? 'Purging...' : 'Purge now'}
          </button>
        </>
      }
    >
      {target ? (
        <div className="space-y-3 text-sm">
          {error ? (
            <p
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          <div className="rounded-lg border border-border bg-surface p-3 text-xs">
            <p className="text-text-primary">{target.name}</p>
            <p className="mt-0.5 text-text-muted">{target.ownerEmail ?? 'No owner email'}</p>
            <code className="mt-1 block break-all font-mono text-[11px] text-text-muted">
              {target.workspaceId}
            </code>
            {isLikelyTest ? (
              <p className="mt-2 text-[11px] text-amber-400">This workspace looks like a test account.</p>
            ) : null}
          </div>
          <label className="block">
            <span className="text-xs text-text-secondary">Type PURGE to confirm</span>
            <input
              value={ack}
              onChange={(e) => setAck(e.target.value.toUpperCase())}
              placeholder="PURGE"
              autoFocus
              className="admin-input mt-1 text-sm"
            />
          </label>
          {needsForce ? (
            <label className="flex items-start gap-2 text-[11px] text-amber-400">
              <input
                type="checkbox"
                checked={force}
                onChange={(e) => setForce(e.target.checked)}
                className="mt-0.5 rounded border-border"
              />
              This workspace has active paid billing. I have reviewed and want to force delete.
            </label>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
