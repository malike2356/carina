import { Button, Heading, Hr, Link, Section, Text } from '@react-email/components';
import React from 'react';
import type { AivaCreatedEmailData } from '../aiva-created-content.js';
import { Layout } from '../components/Layout.js';
import { bodyStyle, emailColors, headingStyle, mutedStyle, primaryButtonStyle } from '../email-styles.js';

export type AivaCreatedEmailProps = AivaCreatedEmailData & {
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

function detailRow(label: string, value: string) {
  return (
    <Text style={{ ...mutedStyle, margin: '0 0 8px' }}>
      <span style={{ color: emailColors.ink, fontWeight: 600 }}>{label}: </span>
      {value}
    </Text>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ ...bodyStyle, fontWeight: 600, color: emailColors.ink, marginBottom: '8px' }}>
      {children}
    </Text>
  );
}

export function AivaCreatedEmail({
  firstName,
  workerName,
  role,
  templateLabel,
  language,
  skillLabels,
  capabilityHints,
  tryNextHints,
  tierLabel,
  hostedEmailAddress,
  connectedChannelLabels,
  portalUrl,
  channelsUrl,
  trainingUrl,
  settingsUrl,
  overviewUrl,
  workspaceUrl,
  supportEmail,
  docsUrl,
  apkUrl,
  unsubscribeUrl,
}: AivaCreatedEmailProps) {
  const [hint1, hint2, hint3] = tryNextHints;

  return (
    <Layout preview={`${workerName} is ready in your workspace`} unsubscribeUrl={unsubscribeUrl}>
      <Heading style={headingStyle}>Meet {workerName}</Heading>
      <Text style={bodyStyle}>
        Hi {firstName}, your new Aiva is live and ready to start work.
      </Text>
      <Text style={mutedStyle}>
        Plan: {tierLabel}. Open the worker below to finish setup, then send a first test message.
      </Text>

      <Section
        style={{
          backgroundColor: emailColors.bg,
          border: `1px solid ${emailColors.border}`,
          borderRadius: '8px',
          padding: '16px 18px',
          margin: '0 0 24px',
        }}
      >
        <SectionTitle>Aiva details</SectionTitle>
        {detailRow('Name', workerName)}
        {detailRow('Role', role)}
        {templateLabel ? detailRow('Template', templateLabel) : null}
        {detailRow('Language', language)}
        {skillLabels.length > 0 ? detailRow('Skills', skillLabels.join(', ')) : null}
        {connectedChannelLabels.length > 0
          ? detailRow('Channels connected', connectedChannelLabels.join(', '))
          : detailRow('Channels connected', 'None yet')}
      </Section>

      {hostedEmailAddress ? (
        <Section style={{ marginBottom: '24px' }}>
          <SectionTitle>Hosted email address</SectionTitle>
          <Text
            style={{
              ...bodyStyle,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: '16px',
              fontWeight: 600,
              color: emailColors.ink,
              marginBottom: '8px',
            }}
          >
            <Link href={`mailto:${hostedEmailAddress}`} style={{ color: emailColors.teal }}>
              {hostedEmailAddress}
            </Link>
          </Text>
          <Text style={mutedStyle}>
            Email tasks, customer messages, PDFs, and instructions here. No Gmail or Outlook
            connection is required for this inbox.
          </Text>
          <Text style={mutedStyle}>
            Tip: add this address to your phone contacts as &quot;{workerName}&quot; so you can
            forward work in one tap.
          </Text>
        </Section>
      ) : (
        <Section style={{ marginBottom: '24px' }}>
          <SectionTitle>Hosted email</SectionTitle>
          <Text style={mutedStyle}>
            A hosted inbox was not assigned yet. When hosted email is enabled for your workspace,
            open the worker overview to create one.
          </Text>
          <Button href={overviewUrl} style={secondaryButtonStyle()}>
            Open overview
          </Button>
        </Section>
      )}

      {capabilityHints.length > 0 ? (
        <Section style={{ marginBottom: '24px' }}>
          <SectionTitle>What {workerName} can help with</SectionTitle>
          {capabilityHints.map((hint) => (
            <Text key={hint} style={{ ...mutedStyle, margin: '0 0 6px' }}>
              - {hint}
            </Text>
          ))}
        </Section>
      ) : null}

      <Section style={{ marginBottom: '24px' }}>
        <SectionTitle>Try these first</SectionTitle>
        <Text style={{ ...mutedStyle, margin: '0 0 6px' }}>1. {hint1}</Text>
        <Text style={{ ...mutedStyle, margin: '0 0 6px' }}>2. {hint2}</Text>
        <Text style={{ ...mutedStyle, margin: '0 0 6px' }}>3. {hint3}</Text>
      </Section>

      <Hr style={{ borderColor: emailColors.border, margin: '8px 0 24px' }} />

      <Section style={{ marginBottom: '24px' }}>
        <SectionTitle>Use Telegram when you are away from the workspace</SectionTitle>
        <Text style={mutedStyle}>
          Telegram is optional, but it is useful when you want to message {workerName} from your
          phone without signing in to the workspace every time. To connect it, create a private bot
          token in Telegram and add it to this Aiva.
        </Text>
        <Text style={{ ...mutedStyle, margin: '0 0 8px' }}>
          1. Open Telegram and message @BotFather.
        </Text>
        <Text style={{ ...mutedStyle, margin: '0 0 8px' }}>
          2. Send /newbot and follow the prompts for the bot name and username.
        </Text>
        <Text style={{ ...mutedStyle, margin: '0 0 8px' }}>
          3. Copy the token BotFather gives you. Keep it private.
        </Text>
        <Text style={{ ...mutedStyle, margin: '0 0 8px' }}>
          4. Open {workerName}, go to Channels, choose Telegram, paste the token, and connect.
        </Text>
        <Text style={{ ...mutedStyle, margin: '0 0 16px' }}>
          5. Send a test message to the new Telegram bot. The conversation will continue with this
          Aiva and show in the workspace conversation history.
        </Text>
        <Button href={channelsUrl} style={secondaryButtonStyle()}>
          Connect Telegram
        </Button>
      </Section>

      <Section style={{ marginBottom: '24px' }}>
        <SectionTitle>Setup checklist</SectionTitle>
        <Text style={{ ...mutedStyle, margin: '0 0 10px' }}>
          1. Open {workerName} and review the role, tone, and escalation settings.
        </Text>
        <Text style={{ ...mutedStyle, margin: '0 0 10px' }}>
          2. Connect Telegram, WhatsApp, Slack, or web chat so people can reach this Aiva.
        </Text>
        <Text style={{ ...mutedStyle, margin: '0 0 10px' }}>
          3. Add training: FAQs, policy PDFs, price lists, and example replies.
        </Text>
        <Text style={{ ...mutedStyle, margin: '0 0 10px' }}>
          4. Review settings and enable tools this Aiva needs (calendar, CRM, sheets, and similar).
        </Text>
        {hostedEmailAddress ? (
          <Text style={{ ...mutedStyle, margin: '0 0 10px' }}>
            5. Send a short test email to {hostedEmailAddress} and confirm the reply path.
          </Text>
        ) : (
          <Text style={{ ...mutedStyle, margin: '0 0 10px' }}>
            5. Send a short test message on any connected channel and confirm the reply path.
          </Text>
        )}
        <Text style={{ ...mutedStyle, margin: '0 0 16px' }}>
          Optional: connect Gmail, Outlook, or IMAP only if this Aiva should work inside an existing
          business mailbox.
        </Text>

        <Button href={portalUrl} style={primaryButtonStyle()}>
          Open {workerName}
        </Button>
        <div style={{ marginTop: '12px' }}>
          <Button href={channelsUrl} style={secondaryButtonStyle()}>
            Connect channels
          </Button>
          <Button href={trainingUrl} style={secondaryButtonStyle()}>
            Add training
          </Button>
          <Button href={settingsUrl} style={secondaryButtonStyle()}>
            Open settings
          </Button>
        </div>
      </Section>

      <Section style={{ marginBottom: '24px' }}>
        <SectionTitle>Your workspace</SectionTitle>
        <Text style={mutedStyle}>
          Manage all Aivas, billing, and activity from your workspace home.
        </Text>
        <Button href={workspaceUrl} style={secondaryButtonStyle()}>
          Open workspace
        </Button>
      </Section>

      {apkUrl ? (
        <Section style={{ marginBottom: '24px' }}>
          <SectionTitle>Aiva on Android</SectionTitle>
          <Text style={mutedStyle}>
            Install the Android app to review escalations and messages on the go.
          </Text>
          <Button href={apkUrl} style={{ ...primaryButtonStyle(), backgroundColor: emailColors.ink }}>
            Download Aiva for Android
          </Button>
        </Section>
      ) : null}

      <Section>
        <SectionTitle>Need help?</SectionTitle>
        <Text style={mutedStyle}>
          Reply to this email or contact{' '}
          <Link href={`mailto:${supportEmail}`} style={{ color: emailColors.teal }}>
            {supportEmail}
          </Link>
          .
        </Text>
        <Text style={mutedStyle}>
          Setup guides:{' '}
          <Link href={docsUrl} style={{ color: emailColors.teal }}>
            {docsUrl}
          </Link>
        </Text>
      </Section>
    </Layout>
  );
}

export { aivaCreatedSubject } from '../aiva-created-content.js';
