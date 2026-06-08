import type { Message } from '../types/index.js';

export type TaskComplexity = 'simple' | 'complex';

const COMPLEX_PATTERNS = [
  /\banaly[sz]e\b/i,
  /\bcompare\b/i,
  /\bstrategy\b/i,
  /\bstrategies\b/i,
  /\bplan\b/i,
  /\bdebug\b/i,
  /\brefactor\b/i,
  /\bimplement\b/i,
  /\bwrite (?:code|a script|tests?)\b/i,
  /\bresearch\b/i,
  /\binvestigate\b/i,
  /\baudit\b/i,
  /\bforecast\b/i,
  /\bmodel\b/i,
  /\boptimise\b/i,
  /\boptimize\b/i,
  /\btrade[- ]?offs?\b/i,
  /\bexit strateg/i,
  /\bdeal pack\b/i,
  /\bdocument\b/i,
  /\bspreadsheet\b/i,
  /\battachment\b/i,
  /\bimage\b/i,
  /\bscreenshot\b/i,
  /\bpdf\b/i,
];

const SIMPLE_PATTERNS = [
  /^\s*(hi|hello|hey|thanks|thank you)\b/i,
  /\bsummary\b/i,
  /\bstatus\b/i,
  /\bremind me\b/i,
  /\bwhat(?:'s| is)\b/i,
  /\bwho is\b/i,
  /\bwhen is\b/i,
  /\bwhere is\b/i,
  /\blist\b/i,
];

function latestUserMessage(messages: Message[]): string {
  return [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
}

function hasLargeContext(messages: Message[]): boolean {
  const totalChars = messages.reduce((sum, message) => sum + message.content.length, 0);
  return totalChars > 5000 || messages.some((message) => message.content.split(/\s+/).length > 800);
}

function hasManyInstructions(text: string): boolean {
  const numberedSteps = text.match(/(?:^|\n)\s*\d+[.)]\s+/g)?.length ?? 0;
  const bulletSteps = text.match(/(?:^|\n)\s*[-*]\s+/g)?.length ?? 0;
  const questionMarks = text.match(/\?/g)?.length ?? 0;
  return numberedSteps + bulletSteps >= 3 || questionMarks >= 3;
}

export function classifyComplexity(messages: Message[]): TaskComplexity {
  const userText = latestUserMessage(messages).trim();
  if (!userText) return 'simple';

  if (hasLargeContext(messages) || hasManyInstructions(userText)) return 'complex';
  if (COMPLEX_PATTERNS.some((pattern) => pattern.test(userText))) return 'complex';

  const wordCount = userText.split(/\s+/).filter(Boolean).length;
  if (wordCount <= 30 && SIMPLE_PATTERNS.some((pattern) => pattern.test(userText))) {
    return 'simple';
  }

  if (wordCount <= 18 && !/[;:]/.test(userText)) return 'simple';

  return 'complex';
}
