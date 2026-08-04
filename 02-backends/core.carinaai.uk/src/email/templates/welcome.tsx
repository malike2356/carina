import { Button, Hr, Heading, Section, Text } from '@react-email/components';
import React from 'react';
import { TelegramSetupGuide } from '../components/TelegramSetupGuide.js';
import { Layout } from '../components/Layout.js';
import { bodyStyle, emailColors, headingStyle, primaryButtonStyle } from '../email-styles.js';

export interface WelcomeEmailProps {
  firstName: string;
  loginUrl: string;
  apkUrl?: string;
  unsubscribeUrl?: string;
}

export function WelcomeEmail({ firstName, loginUrl, unsubscribeUrl }: WelcomeEmailProps) {
  return (
    <Layout preview="Your Aiva account is ready" unsubscribeUrl={unsubscribeUrl}>
      <Heading style={headingStyle}>Welcome, {firstName}</Heading>
      <Text style={bodyStyle}>Your account is active. You can sign in and set up your first Aiva whenever you are ready.</Text>
      <Button href={loginUrl} style={primaryButtonStyle()}>Go to your workspace</Button>
      <Section style={{ marginTop: '28px' }}>
        <Hr style={{ borderColor: emailColors.border, margin: '0 0 24px' }} />
        <Text style={{ ...bodyStyle, fontWeight: '600', marginBottom: '6px' }}>
          Connect Telegram to your Aiva
        </Text>
        <TelegramSetupGuide />
      </Section>
    </Layout>
  );
}

export function welcomeSubject(): string {
  return 'Welcome to VERLOX - your account is ready';
}
