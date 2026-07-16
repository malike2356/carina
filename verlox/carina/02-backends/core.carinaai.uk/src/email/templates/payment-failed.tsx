import { Button, Heading, Text } from '@react-email/components';
import React from 'react';
import { Layout } from '../components/Layout.js';
import { bodyStyle, headingStyle, primaryButtonStyle } from '../email-styles.js';

export interface PaymentFailedEmailProps {
  firstName: string;
  amount: string;
  gracePeriodEndsAt: string;
  updateUrl: string;
}

export function PaymentFailedEmail({
  firstName,
  amount,
  gracePeriodEndsAt,
  updateUrl,
}: PaymentFailedEmailProps) {
  const ends = new Date(gracePeriodEndsAt).toLocaleString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Layout preview="Action needed: payment failed" showUnsubscribe={false}>
      <Heading style={headingStyle}>Action needed: payment failed</Heading>
      <Text style={bodyStyle}>
        Hi {firstName}, we could not collect {amount}. Your Aiva will continue until {ends}.
      </Text>
      <Button href={updateUrl} style={primaryButtonStyle()}>Update payment method</Button>
    </Layout>
  );
}

export function paymentFailedSubject(): string {
  return 'Action needed: payment failed';
}
