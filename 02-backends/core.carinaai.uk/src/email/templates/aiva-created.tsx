import { Button, Heading, Text } from '@react-email/components';
import React from 'react';
import { Layout } from '../components/Layout.js';
import { bodyStyle, headingStyle, primaryButtonStyle } from '../email-styles.js';

export interface AivaCreatedEmailProps {
  firstName: string;
  workerName: string;
  role: string;
  portalUrl: string;
  unsubscribeUrl?: string;
}

export function AivaCreatedEmail({
  firstName,
  workerName,
  role,
  portalUrl,
  unsubscribeUrl,
}: AivaCreatedEmailProps) {
  return (
    <Layout preview={`Meet ${workerName}, your new Aiva`} unsubscribeUrl={unsubscribeUrl}>
      <Heading style={headingStyle}>Meet {workerName}</Heading>
      <Text style={bodyStyle}>Hi {firstName}, your Aiva {workerName} is now configured and ready.</Text>
      <Text style={bodyStyle}>Role: {role}</Text>
      <Button href={portalUrl} style={primaryButtonStyle()}>View your Aiva</Button>
    </Layout>
  );
}

export function aivaCreatedSubject(workerName: string): string {
  return `Meet ${workerName}, your new Aiva`;
}
