import { Button, Heading, Text } from '@react-email/components';
import React from 'react';
import { Layout } from '../components/Layout.js';
import { bodyStyle, headingStyle, mutedStyle, primaryButtonStyle } from '../email-styles.js';

export interface AutomationFailedEmailProps {
  firstName: string;
  workerName: string;
  automationName: string;
  scheduleLabel: string;
  errorMessage: string;
  portalUrl: string;
}

export function AutomationFailedEmail({
  firstName,
  workerName,
  automationName,
  scheduleLabel,
  errorMessage,
  portalUrl,
}: AutomationFailedEmailProps) {
  return (
    <Layout preview={`Automation failed: ${automationName}`} showUnsubscribe={false}>
      <Heading style={headingStyle}>Automation failed: {automationName}</Heading>
      <Text style={bodyStyle}>
        Hi {firstName}, the scheduled automation &quot;{automationName}&quot; for {workerName} failed.
      </Text>
      <Text style={mutedStyle}>Schedule: {scheduleLabel}</Text>
      <Text style={mutedStyle}>Error: {errorMessage}</Text>
      <Button href={portalUrl} style={primaryButtonStyle()}>View automation settings</Button>
    </Layout>
  );
}

export function automationFailedSubject(automationName: string): string {
  return `Automation failed: ${automationName}`;
}
