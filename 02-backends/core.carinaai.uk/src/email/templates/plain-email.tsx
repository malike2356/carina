import { Section, Text } from '@react-email/components';
import React from 'react';
import { EMAIL_TAGLINE, emailColors } from '../email-styles.js';

export interface PlainEmailTemplateProps {
  content: string;
  workerName?: string;
}

const CHANNEL_DISCLAIMER =
  'This message was sent by an AI assistant on behalf of the business. Reply to continue the conversation.';

export function PlainEmailTemplate({ content, workerName }: PlainEmailTemplateProps) {
  return (
    <Section>
      {workerName ? (
        <Text style={{ color: emailColors.muted, fontSize: '12px', margin: '0 0 12px' }}>
          From {workerName}
        </Text>
      ) : null}
      <Text style={{ color: emailColors.ink, fontSize: '15px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
        {content}
      </Text>
      <Text style={{ color: emailColors.muted, fontSize: '12px', margin: '24px 0 0', lineHeight: '1.5' }}>
        {CHANNEL_DISCLAIMER}
      </Text>
      <Text style={{ color: emailColors.muted, fontSize: '11px', margin: '16px 0 0', lineHeight: '1.5' }}>
        {EMAIL_TAGLINE}
      </Text>
    </Section>
  );
}
