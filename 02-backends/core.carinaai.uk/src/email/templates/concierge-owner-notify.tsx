import { Button, Heading, Text } from '@react-email/components';
import React from 'react';
import { Layout } from '../components/Layout.js';
import { bodyStyle, headingStyle, mutedStyle, primaryButtonStyle } from '../email-styles.js';

export type ConciergeOwnerNotifyKind = 'support_case' | 'handoff';

export interface ConciergeOwnerNotifyEmailProps {
  firstName: string;
  businessName: string;
  kind: ConciergeOwnerNotifyKind;
  subject: string;
  summary: string;
  portalUrl: string;
}

export function ConciergeOwnerNotifyEmail({
  firstName,
  businessName,
  kind,
  subject,
  summary,
  portalUrl,
}: ConciergeOwnerNotifyEmailProps) {
  const headline =
    kind === 'handoff'
      ? 'A visitor needs a human handoff'
      : 'A new customer support case was opened';

  return (
    <Layout preview={headline} showUnsubscribe={false}>
      <Heading style={headingStyle}>{headline}</Heading>
      <Text style={bodyStyle}>
        Hi {firstName}, {businessName} has a new Customer Concierge update.
      </Text>
      <Text style={mutedStyle}>Subject: {subject}</Text>
      <Text style={mutedStyle}>{summary}</Text>
      <Button href={portalUrl} style={primaryButtonStyle()}>
        Open concierge inbox
      </Button>
    </Layout>
  );
}

export function conciergeOwnerNotifySubject(kind: ConciergeOwnerNotifyKind): string {
  return kind === 'handoff'
    ? 'Customer Concierge: human handoff requested'
    : 'Customer Concierge: new support case';
}
