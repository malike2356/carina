'use client';

import { useEffect, useState } from 'react';
import { KeyRound, Shield, Trash2 } from 'lucide-react';
import { CarinaEditor } from '@/components/editor';
import { AivaWorkerVaultPanel } from '@/components/aiva/AivaWorkerVaultPanel';
import { AivaWorkerSharingCard } from '@/components/aiva/AivaWorkerSharingCard';
import { AivaWorkerMemoriesPanel } from '@/components/aiva/AivaWorkerMemoriesPanel';
import { AivaOrgSettingsCard } from '@/components/aiva/AivaOrgSettingsCard';
import { TelegramVoicePreferenceToggle } from '@/components/aiva/TelegramVoicePreferenceToggle';
import { IncognitoPreferenceToggle } from '@/components/aiva/IncognitoPreferenceToggle';
import type { AivaWorker, AivaWorkerPermissions } from '@/lib/aiva-types';
import { AIVA_INPUT_CLASS } from '@/lib/aiva-utils';
import { cn } from '@/lib/utils';

const DEFAULT_PERMISSIONS: AivaWorkerPermissions = {
  email: 'anyone',
  whatsapp: 'anyone',
};

function SettingsCard({
  title,
  subtitle,
  action,
  children,
  danger,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border bg-card p-5 sm:p-6',
        danger ? 'border-red-300/60' : 'border-border',
      )}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-text-primary">{title}</h3>
          <p className="mt-1 text-sm text-text-muted">{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function PermissionGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ id: string; label: string; hint: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-text-primary">{label}</p>
      <div className="space-y-2">
        {options.map((option) => (
          <label
            key={option.id}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors',
              value === option.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/25',
            )}
          >
            <input
              type="radio"
              name={label}
              checked={value === option.id}
              onChange={() => onChange(option.id)}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium text-text-primary">{option.label}</span>
              <span className="mt-0.5 block text-xs text-text-muted">{option.hint}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function AivaWorkerSettingsCards({
  worker,
  onWorkerUpdate,
  onDismiss,
  onOpenTools,
}: {
  worker: AivaWorker;
  onWorkerUpdate: (worker: AivaWorker) => void;
  onDismiss: () => void;
  onOpenTools?: () => void;
}) {
  const [roleName, setRoleName] = useState(worker.name);
  const [roleDescription, setRoleDescription] = useState(worker.roleDescription);
  const [language, setLanguage] = useState(worker.language ?? 'en-GB');
  const [permissions, setPermissions] = useState<AivaWorkerPermissions>(
    worker.workerConfig?.permissions ?? DEFAULT_PERMISSIONS,
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dismissOpen, setDismissOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');

  useEffect(() => {
    setRoleName(worker.name);
    setRoleDescription(worker.roleDescription);
    setLanguage(worker.language ?? 'en-GB');
    setPermissions(worker.workerConfig?.permissions ?? DEFAULT_PERMISSIONS);
  }, [worker]);

  async function saveSettings() {
    setSaving(true);
    setSaved(false);
    const res = await fetch(`/api/aiva/workers/${worker.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roleName,
        roleDescription,
        language,
        permissions,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const data = (await res.json()) as { worker?: AivaWorker };
      if (data.worker) onWorkerUpdate(data.worker);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  }

  async function handleDismiss() {
    const res = await fetch(`/api/aiva/workers/${worker.id}`, { method: 'DELETE' });
    if (res.ok) onDismiss();
  }

  const nameMatches = confirmName.trim().toLowerCase() === worker.name.trim().toLowerCase();

  return (
    <div className="space-y-6">
      <SettingsCard
        title="Security and privacy"
        subtitle="Control who can reach this worker on email and WhatsApp."
      >
        <div className="space-y-6">
          <PermissionGroup
            label="Who can email this worker?"
            value={permissions.email}
            onChange={(value) =>
              setPermissions((prev) => ({ ...prev, email: value as AivaWorkerPermissions['email'] }))
            }
            options={[
              { id: 'anyone', label: 'Anyone', hint: 'Public inbox behaviour for this worker email address.' },
              { id: 'organization', label: 'Organization members only', hint: 'Limit to people in your workspace.' },
              { id: 'owner_only', label: 'Only me and co-managers', hint: 'Best for internal testing and private assistants.' },
            ]}
          />
          <PermissionGroup
            label="Who can message this worker on WhatsApp?"
            value={permissions.whatsapp}
            onChange={(value) =>
              setPermissions((prev) => ({
                ...prev,
                whatsapp: value as AivaWorkerPermissions['whatsapp'],
              }))
            }
            options={[
              { id: 'anyone', label: 'Anyone', hint: 'Customers can message once they have the number.' },
              { id: 'organization', label: 'Organization members only', hint: 'Teammates only until you widen access.' },
              { id: 'owner_only', label: 'Only me and co-managers', hint: 'Use while you are still testing the worker.' },
            ]}
          />
          <button type="button" onClick={() => void saveSettings()} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save permissions'}
          </button>
          {saved ? <p className="text-xs text-emerald-600">Settings saved.</p> : null}
        </div>
      </SettingsCard>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SettingsCard
          title="Telegram voice replies"
          subtitle="Keep this on so your Aiva speaks longer answers on Telegram. No special wording needed."
        >
          <TelegramVoicePreferenceToggle
            worker={worker}
            onWorkerUpdate={onWorkerUpdate}
            embedded
          />
        </SettingsCard>

        <SettingsCard
          title="Incognito"
          subtitle="Stop saving chats on our servers. You can also use /incognito_on in Telegram."
        >
          <IncognitoPreferenceToggle
            worker={worker}
            onWorkerUpdate={onWorkerUpdate}
            embedded
          />
        </SettingsCard>
      </div>

      <SettingsCard
        title="Vault"
        subtitle="Store API keys and secrets here. They stay scoped to this worker."
        action={
          <button
            type="button"
            onClick={() => onOpenTools?.()}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:border-primary/30"
          >
            <KeyRound className="h-3.5 w-3.5" />
            Tools
          </button>
        }
      >
        <AivaWorkerVaultPanel workerId={worker.id} />
      </SettingsCard>

      <AivaWorkerMemoriesPanel workerId={worker.id} />
      <AivaWorkerSharingCard workerId={worker.id} />
      <AivaOrgSettingsCard />

      <SettingsCard
        title="Worker policy"
        subtitle="Rules and guidelines for this worker to follow when working."
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-text-primary">Worker name</label>
            <input
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              className={cn(AIVA_INPUT_CLASS, 'mt-1.5')}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-text-primary">Role description</label>
            <CarinaEditor
              value={roleDescription}
              onChange={setRoleDescription}
              variant="compact"
              minHeight="10rem"
              className="mt-1.5"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-text-primary">Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className={cn(AIVA_INPUT_CLASS, 'mt-1.5')}
            >
              <option value="en-GB">English (UK)</option>
              <option value="en-US">English (US)</option>
              <option value="fr">French</option>
              <option value="es">Spanish</option>
            </select>
          </div>
          <button type="button" onClick={() => void saveSettings()} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save worker policy'}
          </button>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Danger zone"
        subtitle="Permanent actions for this worker."
        danger
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-red-200/70 bg-red-50/40 px-4 py-4 dark:border-red-900/40 dark:bg-red-950/20">
            <div>
              <p className="text-sm font-medium text-text-primary">Fire worker</p>
              <p className="mt-0.5 text-xs text-text-muted">
                Permanently remove {worker.name} from your team. This cannot be undone.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDismissOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4" />
              Fire worker
            </button>
          </div>
        </div>
      </SettingsCard>

      {dismissOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-start gap-3">
              <Shield className="mt-0.5 h-5 w-5 text-red-500" />
              <div>
                <h4 className="text-base font-semibold text-text-primary">Fire {worker.name}?</h4>
                <p className="mt-1 text-sm text-text-muted">
                  Type the worker name to confirm permanent removal.
                </p>
              </div>
            </div>
            <input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={worker.name}
              className={cn(AIVA_INPUT_CLASS, 'mb-4')}
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDismissOpen(false)} className="btn-ghost">
                Cancel
              </button>
              <button
                type="button"
                disabled={!nameMatches}
                onClick={() => void handleDismiss()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                Fire worker
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
