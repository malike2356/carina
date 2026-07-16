import { Button, Heading, Text } from '@react-email/components';
import React from 'react';
import { Layout } from '../components/Layout.js';
import { bodyStyle, emailColors, headingStyle, primaryButtonStyle } from '../email-styles.js';

export interface GracePeriodWarningEmailProps {
  firstName: string;
  workerName: string;
  gracePeriodEndsAt: string;
  updateUrl: string;
}

export function GracePeriodWarningEmail({
  firstName,
  workerName,
  gracePeriodEndsAt,
  updateUrl,
}: GracePeriodWarningEmailProps) {
  const ends = new Date(gracePeriodEndsAt).toLocaleString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Layout preview="Your Aiva pauses tomorrow - update payment now" showUnsubscribe={false}>
      <Heading style={{ ...headingStyle, color: emailColors.danger }}>
        Your Aiva pauses tomorrow
      </Heading>
      <Text style={bodyStyle}>
        Hi {firstName}, {workerName} will pause on {ends} unless you update your payment method.
      </Text>
      <Button href={updateUrl} style={{ ...primaryButtonStyle(), backgroundColor: emailColors.danger }}>
        Update payment method now
      </Button>
    </Layout>
  );
}

export function gracePeriodWarningSubject(): string {
  return 'Your Aiva pauses tomorrow - update payment now';
}
