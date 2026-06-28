import { Button, Heading, Text } from '@react-email/components';
import React from 'react';
import { Layout } from '../components/Layout.js';
import { bodyStyle, headingStyle, primaryButtonStyle } from '../email-styles.js';

export interface TrialExpiredEmailProps {
  firstName: string;
  workerName: string;
  upgradeUrl: string;
  unsubscribeUrl?: string;
}

export function TrialExpiredEmail({
  firstName,
  workerName,
  upgradeUrl,
  unsubscribeUrl,
}: TrialExpiredEmailProps) {
  return (
    <Layout preview="Your Aiva trial has ended" unsubscribeUrl={unsubscribeUrl}>
      <Heading style={headingStyle}>Your Aiva trial has ended</Heading>
      <Text style={bodyStyle}>
        Hi {firstName}, your Aiva {workerName} has been paused. Choose a plan to reactivate it.
      </Text>
      <Button href={upgradeUrl} style={primaryButtonStyle()}>Choose a plan</Button>
    </Layout>
  );
}

export function trialExpiredSubject(): string {
  return 'Your Aiva trial has ended';
}
