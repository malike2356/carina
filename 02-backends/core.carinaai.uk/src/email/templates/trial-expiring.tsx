import { Button, Heading, Text } from '@react-email/components';
import React from 'react';
import { Layout } from '../components/Layout.js';
import { bodyStyle, emailColors, headingStyle, primaryButtonStyle } from '../email-styles.js';

export interface TrialExpiringEmailProps {
  firstName: string;
  daysRemaining: number;
  workerName: string;
  upgradeUrl: string;
  trialEndsAt: string;
  unsubscribeUrl?: string;
}

export function TrialExpiringEmail({
  firstName,
  daysRemaining,
  workerName,
  upgradeUrl,
  trialEndsAt,
  unsubscribeUrl,
}: TrialExpiringEmailProps) {
  const ends = new Date(trialEndsAt).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const tone =
    daysRemaining <= 1
      ? `Tomorrow your Aiva ${workerName} pauses unless you choose a plan.`
      : daysRemaining === 2
        ? `Two days remain on your Aiva trial for ${workerName}.`
        : `Your Aiva trial for ${workerName} ends on ${ends}.`;

  return (
    <Layout preview={`${daysRemaining} day(s) left on your Aiva trial`} unsubscribeUrl={unsubscribeUrl}>
      <Heading style={{ ...headingStyle, color: daysRemaining <= 1 ? emailColors.danger : emailColors.amber }}>
        {daysRemaining} day{daysRemaining > 1 ? 's' : ''} left on your trial
      </Heading>
      <Text style={bodyStyle}>Hi {firstName}, {tone}</Text>
      <Button href={upgradeUrl} style={primaryButtonStyle()}>Choose a plan</Button>
    </Layout>
  );
}

export function trialExpiringSubject(daysRemaining: number): string {
  return `${daysRemaining} day${daysRemaining > 1 ? 's' : ''} left on your Aiva trial`;
}
