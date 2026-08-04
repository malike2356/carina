import { Button, Heading, Text } from '@react-email/components';
import React from 'react';
import { Layout } from '../components/Layout.js';
import { bodyStyle, headingStyle, primaryButtonStyle } from '../email-styles.js';

export interface BusinessProvisionWelcomeProps {
  firstName: string;
  workspaceName: string;
  loginUrl: string;
  cnameTarget?: string | null;
  cfOwnershipVerificationName?: string | null;
  cfOwnershipVerificationValue?: string | null;
  unsubscribeUrl?: string;
}

export function BusinessProvisionWelcomeEmail({
  firstName,
  workspaceName,
  loginUrl,
  cnameTarget,
  cfOwnershipVerificationName,
  cfOwnershipVerificationValue,
  unsubscribeUrl,
}: BusinessProvisionWelcomeProps) {
  return (
    <Layout preview="Your Aiva Business workspace is ready" unsubscribeUrl={unsubscribeUrl}>
      <Heading style={headingStyle}>Your Business workspace is ready</Heading>
      <Text style={bodyStyle}>
        Hi {firstName}, your Aiva Business workspace &quot;{workspaceName}&quot; is set up.
        Use the link below to set your password and sign in.
      </Text>
      <Button href={loginUrl} style={primaryButtonStyle()}>Set password and sign in</Button>
      {cnameTarget ? (
        <>
          <Text style={bodyStyle}>
            Custom domain: add a CNAME record pointing your subdomain to {cnameTarget}.
          </Text>
          {cfOwnershipVerificationName && cfOwnershipVerificationValue ? (
            <Text style={bodyStyle}>
              Cloudflare ownership verification TXT: {cfOwnershipVerificationName} ={' '}
              {cfOwnershipVerificationValue}
            </Text>
          ) : null}
        </>
      ) : null}
    </Layout>
  );
}

export function businessProvisionWelcomeSubject(): string {
  return 'Your Aiva Business workspace is ready';
}
