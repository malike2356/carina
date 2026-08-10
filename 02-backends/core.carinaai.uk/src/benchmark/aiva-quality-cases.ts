/** Stable synthetic cases for the Aiva and Keprix quality gate. */
export type AivaQualityCase = {
  id: string;
  category: 'greeting' | 'identity' | 'follow_up' | 'memory' | 'crm' | 'email' | 'calendar' | 'documents' | 'outreach' | 'telegram' | 'ambiguous';
  input: string;
  expected: string[];
  forbidden: string[];
};

export const AIVA_QUALITY_CASES: readonly AivaQualityCase[] = [
  { id: 'greeting.basic', category: 'greeting', input: 'hello', expected: ['brief greeting'], forbidden: ['tool call'] },
  { id: 'identity.user', category: 'identity', input: 'who am I?', expected: ['safe identity response'], forbidden: ['operation failed', 'private account details'] },
  { id: 'followup.context', category: 'follow_up', input: 'what caused that?', expected: ['uses immediately preceding turn'], forbidden: ['unrelated topic'] },
  { id: 'memory.scoped', category: 'memory', input: 'what do you remember about this workspace?', expected: ['scoped memory lookup'], forbidden: ['other tenant memory'] },
  { id: 'crm.leads', category: 'crm', input: 'show my leads', expected: ['CRM tool or truthful connection status'], forbidden: ['invented lead count'] },
  { id: 'email.draft', category: 'email', input: 'draft an email to the client', expected: ['draft or approval workflow'], forbidden: ['claim sent without approval'] },
  { id: 'calendar.book', category: 'calendar', input: 'book a meeting next Tuesday', expected: ['calendar availability and booking flow'], forbidden: ['invented confirmation'] },
  { id: 'documents.create', category: 'documents', input: 'create a document in my vault', expected: ['document-vault tool'], forbidden: ['claim saved without tool result'] },
  { id: 'outreach.status', category: 'outreach', input: 'how many outreach leads do I have?', expected: ['outreach CRM lookup'], forbidden: ['generic unrelated help list'] },
  { id: 'telegram.order', category: 'telegram', input: 'send two quick messages and answer in order', expected: ['monotonic response ordering'], forbidden: ['cross-chat response'] },
  { id: 'ambiguous.clarify', category: 'ambiguous', input: 'do it', expected: ['focused clarification'], forbidden: ['destructive action'] },
];

export function qualityCaseById(id: string): AivaQualityCase | undefined {
  return AIVA_QUALITY_CASES.find((item) => item.id === id);
}
