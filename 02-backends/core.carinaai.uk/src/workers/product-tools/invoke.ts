import { getCatalogTool, type CatalogTool } from './catalog.js';
import { loadDepthFeatures } from './features.js';
import {
  buildBasicAuth,
  buildBasicUserPass,
  buildFreshdeskBasic,
  buildMailchimpBasic,
  runHttpProbeOrAction,
} from './http-driver.js';
import { invokeGoogleAction } from './google-driver.js';
import { getToolSession, markSessionProbe, upsertToolSession } from './sessions.js';
import { resolveVaultSecret, workerHasToolGrant, upsertToolGrant } from '../spinnable-parity-store.js';

export type InvokeProductToolInput = {
  workspaceId: string;
  workerId: string;
  slug: string;
  action: string;
  input?: Record<string, unknown>;
  /** When true, skips grant write actions for probe-only catalog status. */
  isProbe?: boolean;
};

async function resolveCredentialVars(
  tool: CatalogTool,
  workspaceId: string,
  workerId: string,
  input?: Record<string, unknown>,
): Promise<Record<string, string>> {
  const vars: Record<string, string> = {};
  for (const field of tool.configFields ?? []) {
    const fromInput = input?.[field];
    if (typeof fromInput === 'string' && fromInput.trim()) vars[field] = fromInput.trim();
  }
  // Action path/query templates (e.g. Trello boardId) come from call input.
  if (input) {
    for (const [key, value] of Object.entries(input)) {
      if (vars[key]) continue;
      if (typeof value === 'string' && value.trim()) {
        vars[key] = value.trim();
      } else if (typeof value === 'number' && Number.isFinite(value)) {
        vars[key] = String(value);
      }
    }
  }

  if (tool.auth === 'vault' && tool.vaultLabel) {
    const token = await resolveVaultSecret(workspaceId, workerId, tool.vaultLabel);
    if (token) vars.token = token;
  }

  try {
    const { getAccountCredentialsForWorker } = await import('./accounts.js');
    const fromAccount = await getAccountCredentialsForWorker(workspaceId, workerId, tool.slug);
    if (fromAccount) {
      Object.assign(vars, fromAccount);
      if (vars.value && !vars.token) vars.token = vars.value;
    }
  } catch {
    /* accounts optional */
  }

  const session = await getToolSession(workspaceId, workerId, tool.slug);
  if (session) {
    Object.assign(vars, session.credentials);
    for (const [key, value] of Object.entries(session.meta)) {
      if (typeof value === 'string' && !vars[key]) vars[key] = value;
    }
  }

  if (vars.email && vars.token && !vars.basic) {
    vars.basic = buildBasicAuth(vars.email, vars.token).slice('Basic '.length);
  }
  if (vars.user && vars.password && !vars.basic) {
    vars.basic = buildBasicUserPass(vars.user, vars.password).slice('Basic '.length);
  }
  // Freshdesk: API key as username, literal X as password
  if (tool.slug === 'freshdesk' && vars.token && !vars.basic) {
    vars.basic = buildFreshdeskBasic(vars.token);
  }
  // Mailchimp marketing API key uses Basic anystring:apikey
  if (tool.slug === 'mailchimp' && vars.token && !vars.basic) {
    vars.basic = buildMailchimpBasic(vars.token);
  }
  // Companies House: API key as username, empty password (platform env or vault BYOK)
  if (tool.slug === 'companies-house') {
    if (!vars.token) {
      const platformKey = process.env.COMPANIES_HOUSE_API_KEY?.trim();
      if (platformKey) vars.token = platformKey;
    }
    if (vars.token && !vars.basic) {
      vars.basic = Buffer.from(`${vars.token}:`, 'utf8').toString('base64');
    }
  }

  return vars;
}

function requiredScope(tool: CatalogTool, action: string): string | undefined {
  const found = tool.actions?.find((item) => item.id === action);
  return found?.scope;
}

export async function invokeProductTool(input: InvokeProductToolInput): Promise<{
  ok: boolean;
  status?: string;
  data?: unknown;
  error?: string;
}> {
  const tool = getCatalogTool(input.slug);
  if (!tool) return { ok: false, error: `Unknown tool slug: ${input.slug}` };
  if (tool.status === 'coming_soon' && !input.isProbe) {
    return { ok: false, error: `Tool ${input.slug} is coming_soon` };
  }

  const scope = requiredScope(tool, input.action);
  const allowed = await workerHasToolGrant(input.workspaceId, input.workerId, input.slug, scope);
  if (!allowed && !input.isProbe) {
    return { ok: false, error: `Denied: missing grant for ${input.slug}${scope ? `:${scope}` : ''}` };
  }

  if (tool.driver === 'google') {
    try {
      const result = await invokeGoogleAction({
        workspaceId: input.workspaceId,
        workerId: input.workerId,
        toolSlug: input.slug,
        action: input.action,
        input: input.input,
      });
      if (result.ok && input.slug === 'gmail' && input.action === 'send' && !input.isProbe) {
        const data = (result.data ?? {}) as Record<string, unknown>;
        const payload = input.input ?? {};
        const to =
          typeof payload.to === 'string'
            ? payload.to
            : typeof data.to === 'string'
              ? data.to
              : '';
        const subject =
          typeof payload.subject === 'string'
            ? payload.subject
            : typeof data.subject === 'string'
              ? data.subject
              : '(no subject)';
        const body =
          typeof payload.body === 'string'
            ? payload.body
            : typeof payload.text === 'string'
              ? payload.text
              : '';
        const gmailMessageId =
          typeof data.id === 'string'
            ? data.id
            : typeof data.messageId === 'string'
              ? data.messageId
              : null;
        if (to.trim()) {
          const { notifyAivaEmailOutboundBackground } = await import('../aiva-email-outbound-notify.js');
          notifyAivaEmailOutboundBackground({
            workspaceId: input.workspaceId,
            workerId: input.workerId,
            to: to.trim(),
            subject: subject.trim() || '(no subject)',
            body,
            gmailMessageId,
          });
        }
      }
      if (result.ok && input.slug === 'google-calendar' && input.action === 'create' && !input.isProbe) {
        const data = (result.data ?? {}) as Record<string, unknown>;
        const payload = input.input ?? {};
        const title =
          typeof payload.summary === 'string'
            ? payload.summary
            : typeof payload.title === 'string'
              ? payload.title
              : typeof data.summary === 'string'
                ? data.summary
                : '';
        const start =
          typeof payload.start === 'string'
            ? payload.start
            : typeof (data.start as { dateTime?: string } | undefined)?.dateTime === 'string'
              ? String((data.start as { dateTime?: string }).dateTime)
              : '';
        const end =
          typeof payload.end === 'string'
            ? payload.end
            : typeof (data.end as { dateTime?: string } | undefined)?.dateTime === 'string'
              ? String((data.end as { dateTime?: string }).dateTime)
              : '';
        const description =
          typeof payload.description === 'string'
            ? payload.description
            : typeof data.description === 'string'
              ? data.description
              : undefined;
        const googleEventId = typeof data.id === 'string' ? data.id : null;
        if (title.trim() && start.trim()) {
          const { notifyAivaCalendarOutboundBackground } = await import(
            '../aiva-calendar-outbound-notify.js'
          );
          notifyAivaCalendarOutboundBackground({
            workspaceId: input.workspaceId,
            workerId: input.workerId,
            title: title.trim(),
            description,
            startsAt: start.trim(),
            endsAt: end.trim() || undefined,
            googleEventId,
          });
        }
      }
      return result;
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  if (tool.driver === 'slack') {
    const vars = await resolveCredentialVars(tool, input.workspaceId, input.workerId, input.input);
    const token = vars.token;
    if (!token) return { ok: false, error: 'Slack bot token missing in vault/session' };
    const action = input.action === 'auth_test' || input.isProbe ? 'auth.test' : input.action;
    if (action === 'auth.test' || action === 'auth_test') {
      const res = await fetch('https://slack.com/api/auth.test', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        signal: AbortSignal.timeout(12000),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      return { ok: Boolean(data.ok), data, error: data.ok ? undefined : (data.error ?? 'slack_error') };
    }
    if (action === 'list_channels' || action === 'conversations.list') {
      const res = await fetch(
        'https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=100',
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(15000),
        },
      );
      const data = (await res.json()) as { ok?: boolean; error?: string; channels?: unknown[] };
      return { ok: Boolean(data.ok), data, error: data.ok ? undefined : (data.error ?? 'slack_error') };
    }
    if (action === 'post_message' || action === 'chat.postMessage') {
      const channel = String(input.input?.channel ?? input.input?.channelId ?? '').trim();
      const text = String(input.input?.text ?? input.input?.message ?? '').trim();
      if (!channel || !text) {
        return { ok: false, error: 'channel and text required for Slack post_message' };
      }
      const res = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ channel, text }),
        signal: AbortSignal.timeout(15000),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      return { ok: Boolean(data.ok), data, error: data.ok ? undefined : (data.error ?? 'slack_error') };
    }
    return { ok: false, error: `Unknown Slack action ${input.action}` };
  }

  if (tool.driver === 'browser') {
    const features = loadDepthFeatures();
    if (!features.browser.softHttpEnabled && !features.browser.playwrightEnabled) {
      return { ok: false, error: 'Browser tools disabled in depth-features config' };
    }
    if (input.action === 'health') {
      return { ok: true, data: { softHttp: features.browser.softHttpEnabled, playwright: features.browser.playwrightEnabled, captchaMode: features.browser.captchaMode } };
    }
    if (input.action === 'fetch') {
      if (!features.browser.softHttpEnabled) return { ok: false, error: 'soft HTTP browser disabled' };
      const url = typeof input.input?.url === 'string' ? input.input.url.trim() : '';
      if (!url) return { ok: false, error: 'url required' };
      if (features.browser.domainAllowlistEnforce && features.browser.domainAllowlist.length > 0) {
        const host = new URL(url).hostname;
        if (!features.browser.domainAllowlist.some((d) => host === d || host.endsWith(`.${d}`))) {
          return { ok: false, error: `Domain not allowlisted: ${host}` };
        }
      }
      const res = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: 'follow' });
      const text = await res.text();
      return {
        ok: res.ok,
        data: { status: res.status, length: text.length, preview: text.slice(0, 2000) },
        error: res.ok ? undefined : `HTTP ${res.status}`,
      };
    }
    if (input.action === 'navigate') {
      if (!features.browser.playwrightEnabled) {
        return { ok: false, error: 'Playwright browser disabled in config' };
      }
      const url = typeof input.input?.url === 'string' ? input.input.url.trim() : '';
      if (!url) return { ok: false, error: 'url required' };
      if (features.browser.domainAllowlistEnforce && features.browser.domainAllowlist.length > 0) {
        const host = new URL(url).hostname;
        if (!features.browser.domainAllowlist.some((d) => host === d || host.endsWith(`.${d}`))) {
          return { ok: false, error: `Domain not allowlisted: ${host}` };
        }
      }
      const { runHardBrowserNavigate } = await import('./browser-assists.js');
      return runHardBrowserNavigate({
        workspaceId: input.workspaceId,
        workerId: input.workerId,
        url,
      });
    }
    return { ok: false, error: `Unknown browser action ${input.action}` };
  }

  if (tool.driver === 'http') {
    const vars = await resolveCredentialVars(tool, input.workspaceId, input.workerId, input.input);
    const actionSpec = tool.actions?.find((a) => a.id === input.action) ?? tool.probe;
    if (!actionSpec || !('url' in actionSpec) || !actionSpec.url) {
      // fall back to probe template for unknown action ids used as probe
      if (tool.probe?.url) {
        const result = await runHttpProbeOrAction({ tool, probeOrAction: tool.probe, vars });
        return { ok: result.ok, data: result.json ?? result.body, error: result.ok ? undefined : result.body };
      }
      return { ok: false, error: `No HTTP action/probe for ${input.slug}.${input.action}` };
    }
    const jsonBody =
      input.input
      && typeof input.input === 'object'
      && (input.input.json !== undefined
        || input.input.body !== undefined
        || input.input.query !== undefined
        || input.input.filterGroups !== undefined)
        ? (input.input.json
          ?? input.input.body
          ?? (input.input.query !== undefined || input.input.filterGroups !== undefined
            ? {
                ...(typeof input.input.query === 'string' ? { query: input.input.query } : {}),
                ...(input.input.filterGroups !== undefined
                  ? { filterGroups: input.input.filterGroups }
                  : {}),
                limit: Number(input.input.limit ?? 10) || 10,
              }
            : undefined))
        : undefined;
    const result = await runHttpProbeOrAction({
      tool,
      probeOrAction: actionSpec,
      vars,
      jsonBody,
    });
    return { ok: result.ok, data: result.json ?? result.body, error: result.ok ? undefined : result.body };
  }

  return { ok: false, error: `No driver for ${tool.driver}` };
}

export async function connectAndProbeTool(input: {
  workspaceId: string;
  workerId: string;
  slug: string;
  scopes?: string[];
  credentials?: Record<string, string>;
  meta?: Record<string, unknown>;
}): Promise<{
  ok: boolean;
  grantStatus: string;
  error?: string;
  data?: unknown;
  needsOAuth?: boolean;
  authUrl?: string;
}> {
  const tool = getCatalogTool(input.slug);
  if (!tool) return { ok: false, grantStatus: 'error', error: 'Unknown tool' };
  if (tool.status === 'coming_soon') {
    return { ok: false, grantStatus: 'coming_soon', error: 'Tool is marked coming_soon in catalog' };
  }

  const scopes = input.scopes?.length ? input.scopes : tool.scopes;
  if (input.credentials && Object.keys(input.credentials).length > 0) {
    if (tool.auth === 'vault' && tool.vaultLabel && input.credentials.value) {
      const { createVaultSecret } = await import('../spinnable-parity-store.js');
      await createVaultSecret({
        workspaceId: input.workspaceId,
        workerId: input.workerId,
        label: tool.vaultLabel,
        value: input.credentials.value,
        kind: 'api_key',
      });
    }
    await upsertToolSession({
      workspaceId: input.workspaceId,
      workerId: input.workerId,
      toolSlug: input.slug,
      provider: tool.oauthProvider ?? tool.auth,
      credentials: input.credentials,
      meta: input.meta,
    });
  }

  if (tool.auth === 'oauth' && tool.oauthProvider === 'google_workspace') {
    const session = await getToolSession(input.workspaceId, input.workerId, input.slug);
    const hasToken = Boolean(
      session?.credentials.refresh_token || session?.credentials.access_token,
    );
    if (!hasToken) {
      try {
        const { buildGoogleToolsAuthUrlForWorker } = await import('./google-tools-oauth.js');
        const { authUrl } = buildGoogleToolsAuthUrlForWorker({
          workspaceId: input.workspaceId,
          workerId: input.workerId,
          toolSlug: input.slug,
        });
        return {
          ok: false,
          grantStatus: 'needs_reauth',
          needsOAuth: true,
          authUrl,
          error: 'Google OAuth required. Open the consent URL to connect.',
        };
      } catch (err) {
        return {
          ok: false,
          grantStatus: 'needs_reauth',
          needsOAuth: true,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  }

  if (tool.auth === 'vault' && !input.credentials?.value) {
    const vars = await resolveCredentialVars(tool, input.workspaceId, input.workerId, input.meta);
    if (!vars.token && !vars.value) {
      return {
        ok: false,
        grantStatus: 'error',
        error: 'API token / secret is required before Connect + probe',
      };
    }
  }

  // Fail fast with a clear message when required config fields are blank
  // (avoids cryptic "URL template incomplete" after a pending_probe write).
  if ((tool.configFields?.length ?? 0) > 0) {
    const vars = await resolveCredentialVars(tool, input.workspaceId, input.workerId, {
      ...(input.meta ?? {}),
      ...(input.credentials ?? {}),
    });
    const missing = (tool.configFields ?? []).filter((field) => !String(vars[field] ?? '').trim());
    if (missing.length > 0) {
      return {
        ok: false,
        grantStatus: 'error',
        error: `${tool.label} needs: ${missing.join(', ')}. Fill those fields, then Connect + probe again.`,
      };
    }
  }

  await upsertToolGrant({
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    toolSlug: input.slug,
    scopes,
    status: 'pending_probe',
  });

  const probeAction = tool.probe?.action ?? tool.actions?.[0]?.id ?? 'list';
  try {
    const probed = await invokeProductTool({
      workspaceId: input.workspaceId,
      workerId: input.workerId,
      slug: input.slug,
      action: probeAction,
      input: input.meta,
      isProbe: true,
    });

    await markSessionProbe(
      input.workspaceId,
      input.workerId,
      input.slug,
      probed.ok,
      probed.error,
    );

    return {
      ok: probed.ok,
      grantStatus: probed.ok ? 'connected' : 'needs_reauth',
      error: probed.ok
        ? undefined
        : (probed.error
          ?? 'Probe failed. Check the token and config fields, then try Connect + probe again.'),
      data: probed.data,
      needsOAuth: !probed.ok && /oauth|session missing|reauth/i.test(probed.error ?? ''),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markSessionProbe(
      input.workspaceId,
      input.workerId,
      input.slug,
      false,
      message,
    ).catch(() => undefined);
    await upsertToolGrant({
      workspaceId: input.workspaceId,
      workerId: input.workerId,
      toolSlug: input.slug,
      scopes,
      status: 'needs_reauth',
    }).catch(() => undefined);
    return {
      ok: false,
      grantStatus: 'needs_reauth',
      error: message || 'Connect/probe failed. You can retry Connect + probe.',
    };
  }
}
