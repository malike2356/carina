import fs from 'fs';

export type AcpPromptResult = {
  sessionId: string;
  reply: string;
  protocol: string;
};

export type AcpClientOptions = {
  baseUrl: string;
  password?: string;
  passwordFile?: string;
};

function resolvePassword(options: AcpClientOptions): string | undefined {
  if (options.password) return options.password;
  if (options.passwordFile) {
    try {
      return fs.readFileSync(options.passwordFile, 'utf-8').trim();
    } catch {
      return undefined;
    }
  }
  return process.env.CARINA_WEB_PASSWORD ?? process.env.CARINA_OPS_TOKEN;
}

function authHeaders(options: AcpClientOptions): Record<string, string> {
  const password = resolvePassword(options);
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (password) headers.authorization = `Bearer ${password}`;
  return headers;
}

export async function acpCreateSession(
  options: AcpClientOptions,
  body: { label?: string; provenance?: string } = {},
): Promise<{ sessionId: string }> {
  const res = await fetch(`${options.baseUrl.replace(/\/$/, '')}/acp/sessions`, {
    method: 'POST',
    headers: authHeaders(options),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`ACP session create failed: HTTP ${res.status}`);
  return res.json() as Promise<{ sessionId: string }>;
}

export async function acpPrompt(
  options: AcpClientOptions,
  input: { sessionId?: string; prompt: string; provenance?: string; label?: string },
): Promise<AcpPromptResult> {
  const res = await fetch(`${options.baseUrl.replace(/\/$/, '')}/acp/prompt`, {
    method: 'POST',
    headers: authHeaders(options),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ACP prompt failed: HTTP ${res.status} ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<AcpPromptResult>;
}

export async function acpHealth(options: AcpClientOptions): Promise<Record<string, unknown>> {
  const res = await fetch(`${options.baseUrl.replace(/\/$/, '')}/acp/health`, {
    headers: authHeaders(options),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`ACP health failed: HTTP ${res.status}`);
  return res.json() as Promise<Record<string, unknown>>;
}
