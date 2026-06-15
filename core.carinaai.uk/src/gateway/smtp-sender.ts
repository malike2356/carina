import { config } from '../config/index.js';

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  inReplyTo?: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<{ messageId: string }> {
  const { createTransport } = await import('nodemailer');
  const transport = createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.tls,
    auth: { user: config.smtp.user, pass: config.smtp.password },
  });
  const info = await transport.sendMail({
    from: config.smtp.from,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    inReplyTo: opts.inReplyTo,
  });
  return { messageId: String(info.messageId) };
}
