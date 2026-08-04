import { Button, Heading, Hr, Link, Section, Text } from '@react-email/components';
import React from 'react';
import { quickStartBullets, type CompleteWelcomeEmailData } from '../complete-welcome-content.js';
import { TelegramSetupGuide } from '../components/TelegramSetupGuide.js';
import { Layout } from '../components/Layout.js';
import { bodyStyle, emailColors, headingStyle, mutedStyle, primaryButtonStyle } from '../email-styles.js';

export type CompleteWelcomeEmailProps = CompleteWelcomeEmailData & {
  unsubscribeUrl?: string;
};

function secondaryButtonStyle(): Record<string, string | number> {
  return {
    display: 'inline-block',
    backgroundColor: emailColors.white,
    color: emailColors.teal,
    padding: '10px 16px',
    borderRadius: '6px',
    textDecoration: 'none',
    fontSize: '13px',
    fontWeight: '600',
    border: `1px solid ${emailColors.teal}`,
    marginRight: '8px',
    marginBottom: '8px',
  };
}

function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Section style={{ marginBottom: '24px' }}>
      <Text style={{ ...bodyStyle, fontWeight: '600', color: emailColors.ink, marginBottom: '8px' }}>
        {title}
      </Text>
      {children}
    </Section>
  );
}

export function CompleteWelcomeEmail({
  firstName,
  workerName,
  workerRole,
  templateDomain,
  tierLabel,
  connectedChannel,
  pendingChannel,
  workspaceUrl,
  loginUrl,
  channelSetupUrls,
  supportEmail,
  docsUrl,
  unsubscribeUrl,
}: CompleteWelcomeEmailProps) {
  const [bullet1, bullet2, bullet3] = quickStartBullets(templateDomain);
  const reachChannel = connectedChannel ?? pendingChannel;
  const telegramSetupUrl = channelSetupUrls.Telegram ?? channelSetupUrls['Worker channels'] ?? workspaceUrl;

  return (
    <Layout preview={`${workerName} is live`} unsubscribeUrl={unsubscribeUrl}>
      <Heading style={headingStyle}>{workerName} is live</Heading>
      <Text style={bodyStyle}>
        Hi {firstName}, your {workerRole} is ready to work. {tierLabel} plan; cancel anytime.
      </Text>

      <SectionBlock title="Try it now: 3 things your AI can do">
        <Text style={mutedStyle}>1. {bullet1}</Text>
        <Text style={mutedStyle}>2. {bullet2}</Text>
        <Text style={mutedStyle}>3. {bullet3}</Text>
      </SectionBlock>

      <Hr style={{ borderColor: emailColors.border, margin: '24px 0' }} />

      <SectionBlock title="Your AI worker">
        <Text style={mutedStyle}>Name: {workerName}</Text>
        <Text style={mutedStyle}>Role: {workerRole}</Text>
        {connectedChannel ? (
          <Text style={mutedStyle}>
            Connected via: {connectedChannel.name} ({connectedChannel.type})
          </Text>
        ) : null}
      </SectionBlock>

      {reachChannel ? (
        <SectionBlock title="How to reach your AI">
          <Text style={bodyStyle}>{reachChannel.quickStartInstruction}</Text>
          <Text style={mutedStyle}>
            {connectedChannel
              ? 'Your AI replies within seconds. Try sending a test message now.'
              : 'Finish channel setup, then send a test message to confirm everything works.'}
          </Text>
        </SectionBlock>
      ) : null}

      <SectionBlock title="Add more channels">
        <Text style={mutedStyle}>Your AI can work across multiple channels at once:</Text>
        {Object.entries(channelSetupUrls)
          .filter(([label]) => label !== 'Worker channels')
          .map(([label, url]) => (
            <Button key={label} href={url} style={secondaryButtonStyle()}>
              Add {label}
            </Button>
          ))}
      </SectionBlock>

      <SectionBlock title="Connect Telegram for mobile chat">
        <TelegramSetupGuide
          workerName={workerName}
          connectUrl={telegramSetupUrl}
          connectLabel="Connect Telegram"
        />
      </SectionBlock>

      <SectionBlock title="Your workspace">
        <Text style={mutedStyle}>Manage your AI, view activity, and configure settings:</Text>
        <Button href={workspaceUrl} style={primaryButtonStyle()}>Open workspace</Button>
        <Text style={{ ...mutedStyle, marginTop: '12px' }}>
          Or sign in at{' '}
          <Link href={loginUrl} style={{ color: emailColors.teal }}>
            {loginUrl}
          </Link>
        </Text>
      </SectionBlock>

      <SectionBlock title="Need help?">
        <Text style={mutedStyle}>
          Reply to this email or contact{' '}
          <Link href={`mailto:${supportEmail}`} style={{ color: emailColors.teal }}>
            {supportEmail}
          </Link>
        </Text>
        <Text style={mutedStyle}>
          Setup guides:{' '}
          <Link href={docsUrl} style={{ color: emailColors.teal }}>
            {docsUrl}
          </Link>
        </Text>
      </SectionBlock>
    </Layout>
  );
}

export { completeWelcomeSubject } from '../complete-welcome-content.js';
