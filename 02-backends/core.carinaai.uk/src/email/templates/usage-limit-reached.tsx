import { Button, Heading, Text } from '@react-email/components';
import React from 'react';
import { Layout } from '../components/Layout.js';
import { bodyStyle, dangerButtonStyle, headingStyle } from '../email-styles.js';

export interface UsageLimitReachedEmailProps {
  firstName: string;
  workerName: string;
  messageLimit: number;
  billingUrl: string;
}

export function UsageLimitReachedEmail({
  firstName,
  workerName,
  messageLimit,
  billingUrl,
}: UsageLimitReachedEmailProps) {
  return (
    <Layout preview={`${workerName} has reached your monthly message limit`} showUnsubscribe={false}>
      <Heading style={headingStyle}>Monthly message limit reached</Heading>
      <Text style={bodyStyle}>
        Hi {firstName}, {workerName} has reached the {messageLimit.toLocaleString()} message limit on your
        current plan. New inbound messages will receive a limit notice until you upgrade or your usage resets.
      </Text>
      <Text style={bodyStyle}>
        Upgrade to hire more Aivas or move to a plan with a higher monthly message allowance.
      </Text>
      <Button href={billingUrl} style={dangerButtonStyle()}>View plans and upgrade</Button>
    </Layout>
  );
}

export function usageLimitReachedSubject(workerName: string): string {
  return `${workerName} has reached your monthly message limit`;
}
