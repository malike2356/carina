import { Button, Text } from '@react-email/components';
import React from 'react';
import { bodyStyle, emailColors, mutedStyle } from '../email-styles.js';

function step(text: string) {
  return (
    <Text style={{ ...mutedStyle, margin: '0 0 8px' }}>
      {text}
    </Text>
  );
}

function sectionTitle(text: string) {
  return (
    <Text style={{ ...bodyStyle, fontWeight: '600', color: emailColors.ink, marginBottom: '8px' }}>
      {text}
    </Text>
  );
}

export type TelegramSetupGuideProps = {
  /** Worker display name when known; otherwise generic "your Aiva". */
  workerName?: string;
  /** Optional deep link to Channels / Telegram setup. */
  connectUrl?: string;
  /** Button label when connectUrl is set. */
  connectLabel?: string;
};

/**
 * Full Telegram onboarding, in the order users must do it:
 * 1) create a BotFather token, 2) paste it into the worker Channels tab.
 */
export function TelegramSetupGuide({
  workerName,
  connectUrl,
  connectLabel = 'Connect Telegram',
}: TelegramSetupGuideProps) {
  const aivaLabel = workerName?.trim() || 'your Aiva';

  return (
    <>
      <Text style={{ ...mutedStyle, marginBottom: '14px' }}>
        Telegram is optional. Use it when you want to message {aivaLabel} from your phone without
        signing in to the workspace every time. Do the BotFather steps first, then connect the
        token in Aiva.
      </Text>

      {sectionTitle('1. Get the bot token (do this first)')}
      {step('1. Open the Telegram app on your phone, desktop, or web.')}
      {step(
        '2. Search for @BotFather. It is the official Telegram bot (blue checkmark when verified).',
      )}
      {step('3. Start a chat with BotFather and send: /newbot')}
      {step(
        '4. Choose a display name for your bot (what people see in Telegram).',
      )}
      {step(
        '5. Choose a username that ends in "bot", for example MyAivaHelperBot. It must be unique.',
      )}
      {step(
        '6. BotFather replies with an HTTP API token that looks like 1234567890:ABCdefGHIjklmNOPqrSTUvwxYZ. Copy the whole token.',
      )}
      <Text style={{ ...mutedStyle, fontSize: '12px', margin: '0 0 16px' }}>
        Keep the token private. Anyone with it can control your bot. To reset it later, message
        @BotFather, send /mybots, select the bot, then open API Token and regenerate.
      </Text>

      {sectionTitle('2. Connect Telegram to Aiva (do this second)')}
      {step(
        `1. Sign in to your Aiva workspace and open ${aivaLabel} from AI Employees (Workers).`,
      )}
      {step('2. Open the Channels tab.')}
      {step('3. Choose Telegram.')}
      {step('4. Paste the bot token and click Connect (or Save).')}
      {step(
        '5. In Telegram, open the bot you created and send /start or Hello. That links your chat to the Aiva worker.',
      )}
      <Text style={{ ...mutedStyle, margin: '0 0 16px' }}>
        After that, the worker can receive and reply in that Telegram chat. The same conversation
        can continue in the workspace.
      </Text>

      {connectUrl ? (
        <Button
          href={connectUrl}
          style={{
            display: 'inline-block',
            backgroundColor: emailColors.white,
            color: emailColors.teal,
            padding: '10px 16px',
            borderRadius: '6px',
            textDecoration: 'none',
            fontSize: '13px',
            fontWeight: '600',
            border: `1px solid ${emailColors.teal}`,
            marginBottom: '8px',
          }}
        >
          {connectLabel}
        </Button>
      ) : null}
    </>
  );
}
