import { Button, Heading, Text } from '@react-email/components';
import React from 'react';
import { Layout } from '../components/Layout.js';
import { bodyStyle, headingStyle, mutedStyle, primaryButtonStyle } from '../email-styles.js';

export interface EscalationResolvedEmailProps {
  firstName: string;
  workerName: string;
  escalationReason: string;
  resolutionNote: string;
  portalUrl: string;
}

export function EscalationResolvedEmail({
  firstName,
  workerName,
  escalationReason,
  resolutionNote,
  portalUrl,
}: EscalationResolvedEmailProps) {
  return (
    <Layout preview="A conversation was handled by your VA team" showUnsubscribe={false}>
      <Heading style={headingStyle}>A conversation was handled by your VA team</Heading>
      <Text style={bodyStyle}>
        Hi {firstName}, {workerName} escalated a conversation. Your VA team resolved it.
      </Text>
      <Text style={mutedStyle}>Reason: {escalationReason}</Text>
      <Text style={mutedStyle}>Resolution: {resolutionNote}</Text>
      <Button href={portalUrl} style={primaryButtonStyle()}>View conversation</Button>
    </Layout>
  );
}

export function escalationResolvedSubject(): string {
  return 'A conversation was handled by your VA team';
}
