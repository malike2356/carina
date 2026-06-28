import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import React from 'react';
import { EMAIL_TAGLINE, emailColors } from '../email-styles.js';

export interface LayoutProps {
  preview: string;
  children: React.ReactNode;
  showUnsubscribe?: boolean;
  unsubscribeUrl?: string;
}

export function Layout({
  preview,
  children,
  showUnsubscribe = true,
  unsubscribeUrl,
}: LayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: emailColors.bg, fontFamily: 'system-ui, sans-serif', margin: 0 }}>
        <Container
          style={{
            maxWidth: '560px',
            margin: '40px auto',
            backgroundColor: emailColors.white,
            borderRadius: '8px',
            overflow: 'hidden',
          }}
        >
          <Section style={{ backgroundColor: emailColors.ink, padding: '24px 32px' }}>
            <Text style={{ color: emailColors.white, fontSize: '18px', fontWeight: '700', margin: 0 }}>
              VERLOX
            </Text>
            <Text style={{ color: '#9ca3af', fontSize: '12px', margin: '4px 0 0' }}>
              Powered by Carina
            </Text>
          </Section>
          <Section style={{ padding: '32px' }}>{children}</Section>
          <Section
            style={{
              padding: '24px 32px',
              backgroundColor: emailColors.bg,
              borderTop: `1px solid ${emailColors.border}`,
            }}
          >
            <Text style={{ color: emailColors.muted, fontSize: '12px', margin: 0 }}>
              VERLOX Ltd. Registered in England and Wales.
            </Text>
            <Text style={{ color: emailColors.muted, fontSize: '12px', margin: '8px 0 0' }}>
              {EMAIL_TAGLINE}
            </Text>
            {showUnsubscribe && unsubscribeUrl ? (
              <Text style={{ color: emailColors.muted, fontSize: '12px', margin: '8px 0 0' }}>
                <Link href={unsubscribeUrl} style={{ color: emailColors.muted }}>
                  Unsubscribe from these emails
                </Link>
              </Text>
            ) : null}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
