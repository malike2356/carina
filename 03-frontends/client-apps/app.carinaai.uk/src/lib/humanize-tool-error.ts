/**
 * Turn raw probe / API failure bodies into short UI copy.
 * Providers often return HTML or JSON blobs that should not fill the tools grid.
 */
export function humanizeToolError(raw: string | null | undefined, toolLabel?: string): string {
  const text = String(raw ?? '').trim();
  if (!text) {
    return toolLabel
      ? `${toolLabel} connect failed. Check the token and try again.`
      : 'Connect failed. Check the token and try again.';
  }

  const label = toolLabel?.trim() || 'This tool';
  const flat = text.replace(/\s+/g, ' ');

  const apiDisabled = flat.match(
    /(Gmail API|Google Drive API|Google Calendar API|Drive API|[^:]{0,40}API) has not been used in project (\d+) before or it is disabled/i,
  );
  if (apiDisabled) {
    const apiName = apiDisabled[1]!.replace(/\s+API$/i, ' API');
    const projectId = apiDisabled[2];
    return (
      `${label}: ${apiName} is not enabled on Google Cloud project ${projectId}. `
      + `Enable that API in Google Cloud, wait a minute, then Connect + probe (or Sync) again.`
    );
  }

  if (/unauthorized_client/i.test(flat)) {
    return (
      `${label}: Google rejected the saved login (wrong OAuth client). `
      + `Open Guide me / Reconnect and approve Google access again so a fresh token is issued.`
    );
  }

  if (/invalid_grant|expired|revoked/i.test(flat) && /token|oauth|refresh|access/i.test(flat)) {
    return (
      `${label}: Google access expired or was revoked. `
      + `Reconnect with Google, approve access, then try again.`
    );
  }

  if (/<html[\s>]/i.test(text) || /<title>\s*Error\s+(\d+)/i.test(text)) {
    const code = text.match(/Error\s+(\d+)/i)?.[1]
      ?? text.match(/\b(40[0-9]|50[0-9])\b/)?.[1];
    if (code === '405') {
      return `${label}: the API rejected the request (method not allowed). Use Guide me to create the right token, then Connect + probe again.`;
    }
    if (code === '401' || code === '403') {
      return `${label}: token was rejected. Open Guide me, create a fresh token, paste it, then Connect + probe.`;
    }
    return `${label}: the provider returned an HTML error${code ? ` (${code})` : ''}. Check the token and required fields.`;
  }

  try {
    const parsed = JSON.parse(text) as {
      message?: string;
      error?: string | { message?: string; code?: number };
      code?: string;
      status?: number;
      object?: string;
    };
    const nested =
      typeof parsed.error === 'object' && parsed.error
        ? parsed.error.message
        : typeof parsed.error === 'string'
          ? parsed.error
          : undefined;
    const message = (parsed.message || nested || '').trim();
    const code = String(parsed.code ?? '').toLowerCase();
    const status = Number(parsed.status ?? (typeof parsed.error === 'object' ? parsed.error?.code : 0) ?? 0);

    if (message) {
      const nestedDisabled = message.match(
        /(Gmail API|Google Drive API|Google Calendar API|[^:]{0,40}API) has not been used in project (\d+)/i,
      );
      if (nestedDisabled) {
        return humanizeToolError(message, label);
      }
    }

    if (code === 'unauthorized' || status === 401 || /invalid|unauthorized/i.test(message)) {
      return `${label}: API token is invalid or expired. Open Guide me, create a new token, paste it, then Connect + probe.`;
    }
    if (status === 403 || /forbidden|insufficient|scope/i.test(message)) {
      if (/has not been used in project|is disabled/i.test(message)) {
        return humanizeToolError(message, label);
      }
      return `${label}: token is missing permissions. Open Guide me and grant the scopes listed there.`;
    }
    if (message) {
      return `${label}: ${message.slice(0, 160)}`;
    }
  } catch {
    // not JSON
  }

  const clipped = flat.slice(0, 160);
  if (/api token is invalid|unauthorized/i.test(clipped)) {
    return `${label}: API token is invalid or expired. Open Guide me, create a new token, paste it, then Connect + probe.`;
  }
  return clipped;
}
