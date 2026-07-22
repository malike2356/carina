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

export function WelcomeEmail({ firstName, loginUrl, unsubscribeUrl }: WelcomeEmailProps) {
  return (
    <Layout preview="Your Aiva account is ready" unsubscribeUrl={unsubscribeUrl}>
      <Heading style={headingStyle}>Welcome, {firstName}</Heading>
      <Text style={bodyStyle}>Your account is active. You can sign in and set up your first Aiva whenever you are ready.</Text>
      <Button href={loginUrl} style={primaryButtonStyle()}>Go to your workspace</Button>
      <Section style={{ marginTop: '28px' }}>
        <Hr style={{ borderColor: emailColors.border, margin: '0 0 24px' }} />
        <Text style={{ ...bodyStyle, fontWeight: '600', marginBottom: '6px' }}>Connect Telegram to your Aiva</Text>
        <Text style={{ ...mutedStyle, marginBottom: '14px' }}>
          Telegram is optional. Use it if you want to message your Aiva without signing in to the workspace every time.
        </Text>
        <Text style={bodyStyle}>1. Open Telegram and search for @BotFather.</Text>
        <Text style={bodyStyle}>2. Send /newbot and follow BotFather's prompts to name your bot.</Text>
        <Text style={bodyStyle}>3. Copy the bot token BotFather gives you.</Text>
        <Text style={bodyStyle}>4. Sign in to your Aiva workspace, open your Aiva, then choose Channels.</Text>
        <Text style={bodyStyle}>5. Select Telegram, paste the bot token, and click Connect.</Text>
        <Text style={bodyStyle}>6. Open your new Telegram bot and send a test message.</Text>
        <Text style={{ ...mutedStyle, fontSize: '12px', marginTop: '8px' }}>
          Keep your bot token private. Anyone with the token can control that Telegram bot.
        </Text>
      </Section>
    </Layout>
  );
}

export function welcomeSubject(): string {
  return 'Welcome to VERLOX - your account is ready';
}
