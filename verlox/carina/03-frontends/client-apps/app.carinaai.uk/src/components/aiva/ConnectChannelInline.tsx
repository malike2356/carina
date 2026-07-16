'use client';

import { SocialConnectOptions } from '@/components/aiva/SocialConnectOptions';
import { PlanGateSection } from '@/components/billing/PlanGateSection';
import { ManualChannelSetup } from '@/components/channels/ManualChannelSetup';
import { OAuthChannelSetup } from '@/components/channels/OAuthChannelSetup';
import { TelegramSetupWithWorker } from '@/components/channels/TelegramSetup';
import { WebChatSetup } from '@/components/channels/WebChatSetup';
import { isSocialChannelId } from '@/lib/social-channels';
import { cn } from '@/lib/utils';

export type ConnectChannelInlineProps = {
  workerId: string;
  channelType: string;
  channelLabel: string;
  planTier?: string;
  onComplete: () => void;
  onCancel?: () => void;
  className?: string;
};

export function ConnectChannelInline({
  workerId,
  channelType,
  channelLabel,
  planTier = 'trial',
  onComplete,
  onCancel,
  className,
}: ConnectChannelInlineProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {onCancel ? (
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-text-primary">Connect {channelLabel}</h3>
          <button
            type="button"
            onClick={onCancel}
            className="touch-target text-xs text-text-muted hover:text-text-primary"
          >
            Cancel
          </button>
        </div>
      ) : (
        <h3 className="text-sm font-medium text-text-primary">Connect {channelLabel}</h3>
      )}

      <ChannelSetupBody
        workerId={workerId}
        channelType={channelType}
        channelLabel={channelLabel}
        planTier={planTier}
        onComplete={onComplete}
        onCancel={onCancel}
      />
    </div>
  );
}

function ChannelSetupBody({
  workerId,
  channelType,
  channelLabel,
  planTier,
  onComplete,
  onCancel,
}: Omit<ConnectChannelInlineProps, 'className'>) {
  if (channelType === 'web') {
    return <WebChatSetup workerId={workerId} channelLabel={channelLabel} onComplete={onComplete} />;
  }

  if (channelType === 'telegram') {
    return (
      <TelegramSetupWithWorker
        workerId={workerId}
        channelLabel={channelLabel}
        onComplete={onComplete}
        onCancel={onCancel}
      />
    );
  }

  if (channelType === 'email' || channelType === 'whatsapp' || channelType === 'slack') {
    return (
      <OAuthChannelSetup
        workerId={workerId}
        channelType={channelType}
        channelLabel={channelLabel}
        onComplete={onComplete}
        onCancel={onCancel}
      />
    );
  }

  if (isSocialChannelId(channelType)) {
    return (
      <PlanGateSection planRequired="team" currentPlan={planTier ?? 'trial'}>
        <SocialConnectOptions
          workerId={workerId}
          channelType={channelType}
          onConnected={onComplete}
          onClose={onCancel ?? onComplete}
        />
      </PlanGateSection>
    );
  }

  return (
    <ManualChannelSetup
      workerId={workerId}
      channelType={channelType}
      channelLabel={channelLabel}
      onComplete={onComplete}
      onCancel={onCancel}
    />
  );
}
