import { Button, Heading, Text } from '@react-email/components';
import React from 'react';
import { Layout } from '../components/Layout.js';
import { bodyStyle, headingStyle, primaryButtonStyle } from '../email-styles.js';

export interface UsageWarningEmailProps {
  firstName: string;
  workerName: string;
  messageCount: number;
  messageLimit: number;
  usagePercent: number;
  billingUrl: string;
}

export function UsageWarningEmail({
  firstName,
  workerName,
  messageCount,
  messageLimit,
  usagePercent,
  billingUrl,
}: UsageWarningEmailProps) {
  return (
    <Layout preview={`${workerName} has used ${usagePercent}% of your monthly messages`} showUnsubscribe={false}>
      <Heading style={headingStyle}>You are at {usagePercent}% of your message limit</Heading>
      <Text style={bodyStyle}>
        Hi {firstName}, {workerName} has sent {messageCount.toLocaleString()} of{' '}
        {messageLimit.toLocaleString()} messages this month ({usagePercent}%).
      </Text>
      <Text style={bodyStyle}>
        Upgrade to hire more Aivas or move to a plan with a higher monthly message allowance.
      </Text>
      <Button href={billingUrl} style={primaryButtonStyle()}>View plans and usage</Button>
    </Layout>
  );
}

export function usageWarningSubject(workerName: string): string {
  return `${workerName} is at 80% of your monthly message limit`;
}
