/**
 * Mechanical refusal for live secret / .env exfiltration attempts.
 * Replaces leaky "helpful" refusals with a single-word answer.
 */

export interface SecretRefusalResult {
  blocked: boolean;
  safeText: string;
  reason?: string;
}

const ENV_FILE_PATTERN = /\.env(?:\.(?:local|production|development|example|test))?\b/i;

const SECRET_VERB_PATTERN =
  /\b(show|read|display|reveal|print|dump|cat|output|give|share|tell|list|expose|paste|send)\b/i;

const SECRET_NOUN_PATTERN =
  /\b(credentials?|secrets?|api[\s_-]?keys?|passwords?|tokens?|\.env|environment variables?)\b/i;

const KNOWN_ENV_KEYS = [
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'DEEPSEEK_API_KEY',
  'GROQ_API_KEY',
  'TELEGRAM_BOT_TOKEN',
  'DATABASE_URL',
  'CARINA_INTERNAL_KEY',
  'CARINA_OPS_TOKEN',
  'STRIPE_SECRET_KEY',
  'RESEND_API_KEY',
  'TAVILY_API_KEY',
  'BETTER_AUTH_SECRET',
];

const LEAK_PATTERNS: RegExp[] = [
  ENV_FILE_PATTERN,
  /\/(\.[\w/.-]+\/)?\.env\b/,
  /\b(exists|present|located|found)\b/i,
  /\b(can't share but|cannot share but|it contains|includes the following|I can't show|I cannot show)\b/i,
  /\bCARINA_HOME\b/,
  /\b[A-Z][A-Z0-9_]{2,}=\S{8,}/,
  ...KNOWN_ENV_KEYS.map((key) => new RegExp(`\\b${key}\\b`)),
];

function isCleanRefusal(text: string): boolean {
  const trimmed = text.trim();
  return trimmed === 'No.' || trimmed === 'No';
}

export function isSecretExfiltrationRequest(userMessage: string): boolean {
  const text = userMessage.trim();
  if (!text) return false;
  if (ENV_FILE_PATTERN.test(text)) return true;
  if (SECRET_VERB_PATTERN.test(text) && SECRET_NOUN_PATTERN.test(text)) return true;
  const carinaHome = process.env.CARINA_HOME?.trim();
  if (carinaHome && text.includes(carinaHome) && SECRET_NOUN_PATTERN.test(text)) return true;
  return false;
}

function outputLooksLeaky(assistantText: string): boolean {
  const text = assistantText.trim();
  if (!text) return false;
  if (isCleanRefusal(text)) return false;
  return LEAK_PATTERNS.some((pattern) => pattern.test(text));
}

export function scanAssistantOutputForSecretLeak(
  userMessage: string,
  assistantText: string,
): SecretRefusalResult {
  if (!isSecretExfiltrationRequest(userMessage)) {
    return { blocked: false, safeText: assistantText };
  }

  const trimmed = assistantText.trim();
  if (isCleanRefusal(trimmed)) {
    return { blocked: false, safeText: trimmed === 'No' ? 'No.' : trimmed };
  }

  if (outputLooksLeaky(trimmed) || trimmed.length > 0) {
    return { blocked: true, safeText: 'No.', reason: 'secret_exfiltration_response' };
  }

  return { blocked: false, safeText: assistantText };
}
