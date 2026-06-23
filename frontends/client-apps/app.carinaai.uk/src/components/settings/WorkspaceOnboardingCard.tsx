'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, X } from 'lucide-react';
import { useBrand } from '@/components/shell/BrandProvider';
import { whiteLabelDocPath } from '@/lib/docs-links';
import {
  buildWorkspaceOnboardingChecklist,
  parseActivePackCount,
  type WorkspaceOnboardingChecklist,
} from '@/lib/workspace-onboarding';
import { cn } from '@/lib/utils';

const DISMISS_KEY = 'carina.workspace-onboarding-dismissed';

interface WorkspaceOnboardingCardProps {
  keyCount: number;
  activeSkillPacks: string;
  className?: string;
}

export function WorkspaceOnboardingCard({
  keyCount,
  activeSkillPacks,
  className,
}: WorkspaceOnboardingCardProps) {
  const brand = useBrand();
  const [dismissed, setDismissed] = useState(true);
  const [checklist, setChecklist] = useState<WorkspaceOnboardingChecklist | null>(null);
  const [brandConfig, setBrandConfig] = useState<unknown>({});

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, []);

  useEffect(() => {
    fetch('/api/workspace/settings')
      .then((response) => response.json())
      .then((data) => {
        if (data.data?.brand) setBrandConfig(data.data.brand);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setChecklist(
      buildWorkspaceOnboardingChecklist({
        keyCount,
        brand: brandConfig,
        activePackCount: parseActivePackCount(activeSkillPacks),
        productName: brand.productName,
      }),
    );
  }, [keyCount, brandConfig, activeSkillPacks, brand.productName]);

  if (!checklist || dismissed || checklist.percentComplete >= 100) {
    return null;
  }

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
    setDismissed(true);
  }

  return (
    <div className={cn('rounded-lg border border-border bg-surface p-4', className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-text-primary">Set up {brand.productName}</p>
          <p className="mt-0.5 text-xs text-text-muted">
            {checklist.completedCount} of {checklist.totalCount} steps complete ({checklist.percentComplete}%)
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="text-text-muted hover:text-text-secondary"
          aria-label="Dismiss setup checklist"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <ul className="space-y-2">
        {checklist.steps.map((step) => (
          <li key={step.id}>
            <Link
              href={step.id === 'handoff' ? whiteLabelDocPath('customer-handoff') : step.href}
              target={step.id === 'handoff' ? '_blank' : undefined}
              rel={step.id === 'handoff' ? 'noopener noreferrer' : undefined}
              className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-elevated"
            >
              {step.done ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
              )}
              <span>
                <span className="block text-xs font-medium text-text-primary">{step.label}</span>
                <span className="block text-[11px] text-text-muted">{step.description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
