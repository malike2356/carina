import { Button, Hr, Heading, Section, Text } from '@react-email/components';
import React from 'react';
import { Layout } from '../components/Layout.js';
import { bodyStyle, emailColors, headingStyle, mutedStyle, primaryButtonStyle } from '../email-styles.js';

export interface WelcomeEmailProps {
  firstName: string;
  loginUrl: string;
  apkUrl?: string;
  unsubscribeUrl?: string;
}

export function WelcomeEmail({ firstName, loginUrl, apkUrl, unsubscribeUrl }: WelcomeEmailProps) {
  return (
    <Layout preview="Your Aiva account is ready" unsubscribeUrl={unsubscribeUrl}>
      <Heading style={headingStyle}>Welcome, {firstName}</Heading>
      <Text style={bodyStyle}>Your account is active. You can sign in and set up your first Aiva whenever you are ready.</Text>
      <Button href={loginUrl} style={primaryButtonStyle()}>Go to your workspace</Button>
      {apkUrl ? (
        <Section style={{ marginTop: '28px' }}>
          <Hr style={{ borderColor: emailColors.border, margin: '0 0 24px' }} />
          <Text style={{ ...bodyStyle, fontWeight: '600', marginBottom: '6px' }}>Get the app</Text>
          <Text style={{ ...mutedStyle, marginBottom: '14px' }}>Download the Android app and pick up right where you left off.</Text>
          <Button href={apkUrl} style={{ ...primaryButtonStyle(), backgroundColor: emailColors.ink }}>Download Aiva for Android</Button>
          <Text style={{ ...mutedStyle, fontSize: '12px', marginTop: '8px' }}>Install directly - no app store needed.</Text>
        </Section>
      ) : null}
    </Layout>
  );
}

export function welcomeSubject(): string {
  return 'Welcome to VERLOX - your account is ready';
}
