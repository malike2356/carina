'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AivaChannelConnectionsPanel } from '@/components/integrations/AivaChannelConnectionsPanel';
import { ConnectorResourceScopePanel } from '@/components/aiva/ConnectorResourceScopePanel';
import type { IntegrationDef } from '@/lib/integration-catalog';

type ChannelIntegrationDetailProps = {
  integration: IntegrationDef;
  backHref?: string;
  backLabel?: string;
};

export function ChannelIntegrationDetail({
  integration,
  backHref = '/channels',
  backLabel = 'All channels',
}: ChannelIntegrationDetailProps) {
  const isAiva = integration.kind === 'aiva' && integration.aivaChannelType;

  return (
    <div className="mx-auto max-w-[90rem] px-6 py-8">
      <Link
        href={backHref}
        className="mb-4 inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {backLabel}
      </Link>
      <h1 className="text-lg font-semibold text-text-primary">{integration.label}</h1>
      <p className="mt-1 text-xs text-text-muted">{integration.description}</p>

      <section className="mt-6 rounded-lg border border-border bg-elevated px-4 py-3">
        <h2 className="text-xs font-medium text-text-primary">Setup checklist</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-text-secondary">
          {integration.setupSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      {isAiva ? (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-medium text-text-secondary">Your Aivas</h2>
          <AivaChannelConnectionsPanel
            channelType={integration.aivaChannelType!}
            channelLabel={integration.label}
          />
          <div className="mt-6">
            <ConnectorResourceScopePanel />
          </div>
        </section>
      ) : (
        <div className="mt-6">
          <Link
            href={integration.configureHref}
            className="rounded-md bg-accent px-3 py-2 text-xs text-primary-foreground"
          >
            Open {integration.label} settings
          </Link>
        </div>
      )}
    </div>
  );
}
