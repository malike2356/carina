export interface N8nIlaudConfig {
  enabled: boolean;
  engagementWebhookUrl: string;
  postWebhookUrl: string;
  tokenHealthWebhookUrl: string;
  approvalBaseUrl: string;
  webhookSecret: string;
}

export function resolveN8nIlaudConfig(): N8nIlaudConfig {
  const appUrl =
    process.env.AIVA_APP_URL?.trim()
    ?? process.env.CARINA_PUBLIC_URL?.trim()
    ?? 'https://admin.hireaiva.co.uk';
  const n8nBase = (process.env.N8N_BASE_URL ?? '').replace(/\/$/, '');

  return {
    enabled: process.env.N8N_ILAUD_ENABLED !== 'false',
    engagementWebhookUrl:
      process.env.N8N_ILAUD_WEBHOOK_URL?.trim()
      ?? (n8nBase ? `${n8nBase}/webhook/ilaud-engagement` : ''),
    postWebhookUrl:
      process.env.N8N_ILAUD_POST_WEBHOOK_URL?.trim()
      ?? (n8nBase ? `${n8nBase}/webhook/ilaud-post-schedule` : ''),
    tokenHealthWebhookUrl:
      process.env.N8N_ILAUD_TOKEN_HEALTH_WEBHOOK_URL?.trim()
      ?? (n8nBase ? `${n8nBase}/webhook/ilaud-token-health` : ''),
    approvalBaseUrl: appUrl.replace(/\/$/, ''),
    webhookSecret: process.env.N8N_ILAUD_WEBHOOK_SECRET?.trim() ?? '',
  };
}

export function isN8nIlaudConfigured(): boolean {
  const cfg = resolveN8nIlaudConfig();
  return cfg.enabled && Boolean(
    cfg.engagementWebhookUrl || cfg.postWebhookUrl || cfg.tokenHealthWebhookUrl,
  );
}
