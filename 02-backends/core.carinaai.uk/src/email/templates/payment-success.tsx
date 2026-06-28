import { Button, Heading, Text } from '@react-email/components';
import React from 'react';
import { Layout } from '../components/Layout.js';
import { bodyStyle, headingStyle, mutedStyle, primaryButtonStyle } from '../email-styles.js';

export interface PaymentSuccessEmailProps {
  firstName: string;
  planName: string;
  amount: string;
  nextBillingDate: string;
  invoiceUrl: string;
}

export function PaymentSuccessEmail({
  firstName,
  planName,
  amount,
  nextBillingDate,
  invoiceUrl,
}: PaymentSuccessEmailProps) {
  return (
    <Layout preview={`Payment confirmed - Aiva ${planName}`} showUnsubscribe={false}>
      <Heading style={headingStyle}>Payment confirmed</Heading>
      <Text style={bodyStyle}>Hi {firstName}, we received your payment for Aiva {planName}.</Text>
      <Text style={mutedStyle}>Amount: {amount}</Text>
      <Text style={mutedStyle}>Next billing date: {nextBillingDate}</Text>
      <Button href={invoiceUrl} style={primaryButtonStyle()}>Download invoice</Button>
    </Layout>
  );
}

export function paymentSuccessSubject(planName: string): string {
  return `Payment confirmed - Aiva ${planName}`;
}
