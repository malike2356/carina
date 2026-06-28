import { Heading, Text } from '@react-email/components';
import React from 'react';
import { Layout } from '../components/Layout.js';
import { bodyStyle, headingStyle } from '../email-styles.js';

export interface AccountDeletedEmailProps {
  firstName: string;
}

export function AccountDeletedEmail({ firstName }: AccountDeletedEmailProps) {
  return (
    <Layout preview="Your account has been deleted" showUnsubscribe={false}>
      <Heading style={headingStyle}>Your account has been deleted</Heading>
      <Text style={bodyStyle}>
        Hi {firstName}, this confirms that your VERLOX account and associated Aiva data have been
        scheduled for deletion. Personal conversation content will be removed within 30 days.
      </Text>
      <Text style={bodyStyle}>
        Blockchain attestation hashes remain on the public ledger without personal data. Invoice
        records may be retained in anonymized form as required by UK law.
      </Text>
    </Layout>
  );
}

export function accountDeletedSubject(): string {
  return 'Your account has been deleted';
}
