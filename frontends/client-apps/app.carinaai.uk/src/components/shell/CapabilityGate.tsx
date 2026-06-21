'use client';

import Link from 'next/link';
import type { CloudCapabilityKey, CloudCapabilities } from '@/lib/cloud-capabilities';
import { hasCloudCapability } from '@/lib/cloud-capabilities';
import { useCloudCapabilities } from '@/hooks/useCloudCapabilities';
import { cn } from '@/lib/utils';

type Props = {
  requires: CloudCapabilityKey | CloudCapabilityKey[];
  children: React.ReactNode;
  fallback?: 'hide' | 'badge' | 'link-to-settings';
  className?: string;
};

function isAllowed(capabilities: CloudCapabilities, requires: CloudCapabilityKey | CloudCapabilityKey[]) {
  const keys = Array.isArray(requires) ? requires : [requires];
  return keys.every((key) => hasCloudCapability(capabilities, key));
}

export function CapabilityGate({
  requires,
  children,
  fallback = 'hide',
  className,
}: Props) {
  const { capabilities, loading } = useCloudCapabilities();

  if (loading || !capabilities) return null;
  if (isAllowed(capabilities, requires)) {
    return <>{children}</>;
  }

  if (fallback === 'hide') return null;

  if (fallback === 'link-to-settings') {
    return (
      <Link
        href="/settings"
        className={cn('text-xs text-muted hover:text-text-primary', className)}
      >
        Requires core connection (Settings)
      </Link>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted',
        className,
      )}
      title="Requires a connection to your Carina core instance"
    >
      Core
    </span>
  );
}

export function useCapabilityAllowed(requires: CloudCapabilityKey | CloudCapabilityKey[]): boolean {
  const { capabilities, loading } = useCloudCapabilities();
  if (loading || !capabilities) return false;
  return isAllowed(capabilities, requires);
}
