'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { WorkspaceCapabilitiesPayload } from '@/lib/workspace-capabilities';
import { cn } from '@/lib/utils';

const DISMISS_KEY = 'carina.workspace-setup-guide-dismissed';

type SetupStep = {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  href: string;
  actionLabel: string;
};

type SetupGuideProps = {
  workspaceId: string;
  payload: WorkspaceCapabilitiesPayload;
  className?: string;
};

export function SetupGuide({ workspaceId, payload, className }: SetupGuideProps) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(true);
  const worker = payload.worker;

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(`${DISMISS_KEY}:${workspaceId}`) === '1');
    } catch {
      setDismissed(false);
    }
  }, [workspaceId]);

  const steps = useMemo<SetupStep[]>(() => {
    if (!worker) return [];

    const personaName = worker.name;
    const roleSnippet = worker.roleDescription.split(/[.!?]/)[0]?.trim() || worker.roleDescription;

    return [
      {
        id: 'persona',
        title: 'Your AI is configured',
        description: `${personaName}: ${roleSnippet}`,
        completed: true,
        href: `/aiva/workers/${worker.id}`,
        actionLabel: 'Customise',
      },
      {
        id: 'channels',
        title: worker.connectedChannelCount > 0
          ? `${worker.connectedChannelCount} channel(s) connected`
          : 'Connect a channel',
        description: worker.connectedChannelCount > 0
          ? 'Your AI is reachable on your connected channels.'
          : 'Your AI needs a way to reach you. Takes about 30 seconds.',
        completed: worker.connectedChannelCount > 0,
        href: '/channels',
        actionLabel: worker.connectedChannelCount > 0 ? 'Add more' : 'Connect now',
      },
      {
        id: 'tools',
        title: `${Math.max(worker.installedToolCount, 1)} tools active`,
        description: 'Your AI can search the web, read files, send emails, and more.',
        completed: true,
        href: `/aiva/workers/${worker.id}`,
        actionLabel: 'Browse tools',
      },
      {
        id: 'skills',
        title: `${Math.max(worker.installedSkillCount, 1)} skill packs installed`,
        description: 'Pre-built capabilities for your use case.',
        completed: true,
        href: '/packs',
        actionLabel: 'Browse skills',
      },
      {
        id: 'knowledge',
        title: 'Add your knowledge',
        description: 'Upload documents, FAQs, or connect Notion. Your AI learns from your content.',
        completed: worker.hasKnowledge,
        href: '/knowledge',
        actionLabel: worker.hasKnowledge ? 'Manage' : 'Upload',
      },
      {
        id: 'scout',
        title: 'Scout protection active',
        description: 'Prompt injection defence, kill switch, and audit trail.',
        completed: true,
        href: '/settings/governance',
        actionLabel: 'View dashboard',
      },
    ];
  }, [worker]);

  const incomplete = steps.filter((step) => !step.completed);
  const completedCount = steps.filter((step) => step.completed).length;
  const allDone = steps.length > 0 && incomplete.length === 0;

  if (!worker || dismissed || allDone) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(`${DISMISS_KEY}:${workspaceId}`, '1');
    } catch {
      // ignore
    }
    setDismissed(true);
  }

  return (
    <div className={cn('rounded-lg border border-border bg-surface p-4', className)}>
      {payload.setupTip ? (
        <div className="mb-4 rounded-md border border-border bg-elevated p-3">
          <p className="text-sm font-medium text-text-primary">{payload.setupTip.title}</p>
          <p className="mt-1 text-xs text-text-muted">{payload.setupTip.body}</p>
        </div>
      ) : null}

      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-text-primary">Setup Guide</h3>
          <p className="text-xs text-text-muted">
            {completedCount} of {steps.length} complete
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="text-xs text-text-muted hover:text-text-secondary"
        >
          Dismiss
        </button>
      </div>

      <div className="mb-4 h-1 overflow-hidden rounded-full bg-overlay">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${(completedCount / steps.length) * 100}%` }}
        />
      </div>

      <div className="space-y-2">
        {incomplete.slice(0, 2).map((step) => (
          <div
            key={step.id}
            className="flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-medium text-text-primary">{step.title}</p>
              <p className="text-xs text-text-muted">{step.description}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => router.push(step.href)}
            >
              {step.actionLabel}
            </Button>
          </div>
        ))}
      </div>

      {incomplete.length > 2 ? (
        <Link href="/home" className="mt-3 inline-block text-xs text-accent hover:underline">
          +{incomplete.length - 2} more steps
        </Link>
      ) : null}
    </div>
  );
}
