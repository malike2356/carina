export type OutboundAttachment = {
  filename: string;
  mimeType: string;
  /** Standard base64 (not base64url). */
  contentBase64: string;
};

function encodeSubject(subject: string): string {
  // Keep ASCII subjects plain; encode non-ASCII with RFC 2047.
  if (/^[\x20-\x7E]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
}

function safeMimeFilename(filename: string): string {
  return filename.replace(/["\\\r\n]/g, '_').slice(0, 180) || 'attachment.bin';
}

/**
 * Build an RFC 5322 message for Gmail `users.messages.send` raw MIME.
 */
export function buildOutboundRawMime(input: {
  to: string;
  subject: string;
  text: string;
  from?: string;
  attachments?: OutboundAttachment[];
}): string {
  const to = input.to.trim();
  const subject = encodeSubject(input.subject.trim() || '(no subject)');
  const text = input.text ?? '';
  const from = input.from?.trim();
  const attachments = (input.attachments ?? []).filter(
    (item) => item.contentBase64 && item.filename,
  );

  if (attachments.length === 0) {
    const lines = [
      from ? `From: ${from}` : null,
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      text,
    ].filter((line) => line !== null);
    return lines.join('\r\n');
  }

  const boundary = `aiva_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  const parts: string[] = [
    from ? `From: ${from}` : '',
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    text,
  ].filter((line, index, arr) => {
    // Drop empty From placeholder only.
    if (index === 0 && line === '') return false;
    return true;
  });

  for (const file of attachments) {
    const filename = safeMimeFilename(file.filename);
    const mimeType = file.mimeType || 'application/octet-stream';
    const wrapped = file.contentBase64.replace(/(.{76})/g, '$1\r\n').replace(/\r\n$/g, '');
    parts.push(
      `--${boundary}`,
      `Content-Type: ${mimeType}; name="${filename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${filename}"`,
      '',
      wrapped,
    );
  }

  parts.push(`--${boundary}--`, '');
  return parts.join('\r\n');
}
