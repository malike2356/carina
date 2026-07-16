import { Button, Heading, Text } from '@react-email/components';
import React from 'react';
import { Layout } from '../components/Layout.js';
import { bodyStyle, headingStyle, primaryButtonStyle } from '../email-styles.js';

export interface PasswordResetEmailProps {
  resetUrl: string;
  expiresInMinutes: number;
}

export function PasswordResetEmail({ resetUrl, expiresInMinutes }: PasswordResetEmailProps) {
  return (
    <Layout preview="Reset your password" showUnsubscribe={false}>
      <Heading style={headingStyle}>Reset your password</Heading>
      <Text style={bodyStyle}>
        Click below to reset your password. This link expires in {expiresInMinutes} minutes.
      </Text>
      <Button href={resetUrl} style={primaryButtonStyle()}>Reset password</Button>
      <Text style={bodyStyle}>If you did not request this, you can ignore this email.</Text>
    </Layout>
  );
}

export function passwordResetSubject(): string {
  return 'Reset your password';
}
