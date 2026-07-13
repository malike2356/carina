'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Globe, Hash, Mail, MessageCircle, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AIVA_CHANNEL_OPTIONS,
  AIVA_ROLE_TEMPLATE_CARDS,
  type AivaRoleTemplateCard,
} from '@/lib/aiva-role-templates';
import { AIVA_INPUT_CLASS, readAivaError } from '@/lib/aiva-utils';
import { CarinaEditor } from '@/components/editor';
import { UpgradeModal } from '@/components/aiva/UpgradeModal';

const CHANNEL_ICONS = {
  whatsapp: MessageCircle,
  email: Mail,
  slack: Hash,
  telegram: Send,
  web: Globe,
} as const;

export function AivaHireClient() {
  const router = useRouter();
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [language, setLanguage] = useState('en-GB');
  const [channels, setChannels] = useState<string[]>([]);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [channelError, setChannelError] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeMeta, setUpgradeMeta] = useState({ currentTier: 'trial', slotLimit: 1 });

  function fillFromTemplate(card: AivaRoleTemplateCard) {
    setSelectedCard(card.id);
    setTemplateId(card.templateId);
    setRoleName(card.roleName);
    setRoleDescription(card.roleDescription);
    setChannels([...card.defaultChannels]);
    setChannelError(null);
  }

  function toggleChannel(id: string) {
    setChannels((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
    setChannelError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (channels.length === 0) {
      setChannelError('Select at least one channel');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/aiva/workers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roleName,
          roleDescription,
          language,
          channels,
          templateId,
        }),
      });
      if (!res.ok) {
        if (res.status === 402) {
          const body = (await res.json()) as {
            error?: string;
            currentTier?: string;
            slotLimit?: number;
          };
          if (body.error === 'aiva_slot_limit_reached') {
            setUpgradeMeta({
              currentTier: String(body.currentTier ?? 'trial'),
              slotLimit: Number(body.slotLimit ?? 1),
            });
            setUpgradeOpen(true);
            return;
          }
        }
        setError(await readAivaError(res));
        return;
      }
      const data = (await res.json()) as { worker?: { id: string } };
      if (data.worker?.id) {
        router.push(`/aiva/workers/${data.worker.id}`);
      } else {
        setError('Worker created but no id returned');
      }
    } catch {
      setError('Could not create Aiva. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        reason="slot_limit"
        currentTier={upgradeMeta.currentTier}
        slotLimit={upgradeMeta.slotLimit}
      />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold">Hire an Aiva</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Describe the role in plain English. Your Aiva will be ready in under three minutes.
            Powered by Carina. Escalations are visible when human review is needed.
          </p>
        </div>

        <div>
          <label className="text-sm font-medium text-text-primary">
            What should I call this Aiva?
          </label>
          <input
            name="roleName"
            required
            value={roleName}
            onChange={(e) => {
              setRoleName(e.target.value);
              setSelectedCard(null);
            }}
            placeholder="e.g. Aria, Property Manager, Friday"
            className={`mt-1.5 ${AIVA_INPUT_CLASS}`}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-text-primary">
            What does this Aiva do?
          </label>
          <CarinaEditor
            value={roleDescription}
            onChange={(value) => {
              setRoleDescription(value);
              setSelectedCard(null);
            }}
            placeholder={'Describe the tasks, tone, and who it talks to.\nExample: Handles tenant WhatsApp messages about maintenance and rent.\nTone is professional and reassuring. Escalates anything legal or urgent.'}
            variant="compact"
            minHeight="8rem"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-text-primary">Language</label>
          <select
            name="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className={`mt-1.5 ${AIVA_INPUT_CLASS}`}
          >
            <option value="en-GB">English (UK)</option>
            <option value="en-US">English (US)</option>
            <option value="fr">French</option>
            <option value="es">Spanish</option>
            <option value="ar">Arabic</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-text-primary">Channels</label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {AIVA_CHANNEL_OPTIONS.map((ch) => {
              const Icon = CHANNEL_ICONS[ch.id];
              const checked = channels.includes(ch.id);
              return (
                <label
                  key={ch.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                    checked ? 'border-accent bg-accent-dim' : 'border-border bg-elevated',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleChannel(ch.id)}
                    className="rounded border-border"
                  />
                  <Icon className="h-4 w-4 text-text-muted" />
                  <span className="text-text-primary">{ch.label}</span>
                </label>
              );
            })}
          </div>
          {channelError ? (
            <p className="mt-2 text-sm text-danger">{channelError}</p>
          ) : null}
        </div>

        {selectedCard === 'property-manager' ? (
          <div className="rounded-lg border border-accent/30 bg-accent-dim/40 p-4 text-sm text-text-secondary">
            <p className="font-medium text-text-primary">Propreneur portfolio (optional next step)</p>
            <p className="mt-1 text-xs leading-relaxed">
              Property Manager Aivas use the property-uk skill pack. After hire, open the Aiva Settings tab to bind
              a Propreneur workspace (tenant slug + Carina Remote API key). Phase 1 is read-only: daily briefings
              and portfolio Q&A on Telegram; CRM writes stay in Propreneur.
            </p>
            <a
              href="https://docs.carinaai.uk/user/integrations/propreneur-bridge"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs text-accent hover:underline"
            >
              Propreneur bridge docs
            </a>
          </div>
        ) : null}

        <div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full opacity-100 sm:w-auto disabled:opacity-70"
          >
            {isSubmitting
              ? `Configuring ${roleName || 'your Aiva'}...`
              : 'Meet your Aiva'}
          </button>
          {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
        </div>
      </form>

      <aside>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
          Or start from a template
        </p>
        <div className="flex flex-col gap-2">
          {AIVA_ROLE_TEMPLATE_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => fillFromTemplate(card)}
                className={cn(
                  'w-full rounded-lg border p-3 text-left transition-colors hover:border-accent',
                  selectedCard === card.id
                    ? 'border-accent bg-accent-dim'
                    : 'border-border bg-elevated',
                )}
              >
                <div className="mb-1 flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-text-muted" />
                  <span className="text-xs font-medium text-text-primary">{card.label}</span>
                </div>
                {card.exampleQ ? (
                  <p className="truncate text-[11px] italic text-text-muted">{card.exampleQ}</p>
                ) : null}
                <p className="truncate text-[11px] text-accent">{card.exampleA}</p>
              </button>
            );
          })}
        </div>
      </aside>
    </div>
    </>
  );
}
