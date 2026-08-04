import { Button, Heading, Text } from '@react-email/components';
import React from 'react';
import { Layout } from '../components/Layout.js';
import { bodyStyle, headingStyle, primaryButtonStyle } from '../email-styles.js';

export interface SubscriptionSuspendedEmailProps {
  firstName: string;
  workerName: string;
  reactivateUrl: string;
}

export function SubscriptionSuspendedEmail({
  firstName,
  workerName,
  reactivateUrl,
}: SubscriptionSuspendedEmailProps) {
  return (
    <Layout preview="Your Aiva has been paused" showUnsubscribe={false}>
      <Heading style={headingStyle}>Your Aiva has been paused</Heading>
      <Text style={bodyStyle}>
        Hi {firstName}, your Aiva {workerName} is paused due to an unresolved payment issue.
      </Text>
      <Button href={reactivateUrl} style={primaryButtonStyle()}>Reactivate your Aiva</Button>
    </Layout>
  );
}

export function subscriptionSuspendedSubject(): string {
  return 'Your Aiva has been paused';
}
