export const TWILIO_SMS_MAX_BODY = 1600;

export interface TwilioSmsSendInput {
  accountSid: string;
  authToken: string;
  from: string;
  to: string;
  body: string;
}

export interface SendTwilioSmsOptions {
  timeoutMs?: number;
}

export function buildTwilioBasicAuth(accountSid: string, authToken: string): string {
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`, 'utf8').toString('base64')}`;
}

export async function sendTwilioSms(
  input: TwilioSmsSendInput,
  options: SendTwilioSmsOptions = {},
): Promise<void> {
  const { accountSid, authToken, from, to, body } = input;
  if (!accountSid || !authToken || !from || !to) {
    throw new Error('Twilio SMS: accountSid, authToken, from, and to are required');
  }

  const timeoutMs = options.timeoutMs ?? 10_000;
  const trimmedBody = body.slice(0, TWILIO_SMS_MAX_BODY);

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: buildTwilioBasicAuth(accountSid, authToken),
      },
      body: new URLSearchParams({ To: to, From: from, Body: trimmedBody }),
      signal: AbortSignal.timeout(timeoutMs),
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Twilio API error ${response.status}: ${text}`);
  }
}
