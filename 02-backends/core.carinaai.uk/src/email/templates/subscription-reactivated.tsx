import { Button, Heading, Text } from '@react-email/components';
import React from 'react';
import { Layout } from '../components/Layout.js';
import { bodyStyle, headingStyle, primaryButtonStyle } from '../email-styles.js';

export interface SubscriptionReactivatedEmailProps {
  firstName: string;
  workerName: string;
  portalUrl: string;
}

export function SubscriptionReactivatedEmail({
  firstName,
  workerName,
  portalUrl,
}: SubscriptionReactivatedEmailProps) {
  return (
    <Layout preview="Your Aiva is running again" showUnsubscribe={false}>
      <Heading style={headingStyle}>Your Aiva is running again</Heading>
      <Text style={bodyStyle}>
        Hi {firstName}, payment resolved. {workerName} is active and ready.
      </Text>
      <Button href={portalUrl} style={primaryButtonStyle()}>View your Aiva</Button>
    </Layout>
  );
}

export function subscriptionReactivatedSubject(): string {
  return 'Your Aiva is running again';
}
