/**
 * Internal-first search escalation: known workspace sources before the open web.
 */

export const SEARCH_ESCALATION_POLICY = [
  'Search escalation (always):',
  '1. Start with known internal sources for this workspace: conversation working set, Contacts, Gmail/email,',
  '   Google Drive, Calendar, Documents, Research, Trello (if connected), memory, and prior chat.',
  '2. Person / name lookups: use contacts search first (partial + close spellings). If several people match,',
  '   list them and ask which one. If contacts returns no match, say so; do not invent another person,',
  '   and do not open Documents next unless the user asked for a file/doc.',
  '3. If one source lacks the field (e.g. Contacts has phone but no email), immediately search the next',
  '   relevant internal source. Do not stop and ask the user whether to continue.',
  '4. Only after internal sources are exhausted, search the open web.',
  '5. Do not ask clarifying questions about what "internal" means. Internal = workspace tools and data you already have.',
  '6. Report what you checked and what you found. Save stable facts (email, phone) when the user wants them kept.',
].join('\n');

export function buildSearchEscalationHint(message: string): string | null {
  const text = message.trim();
  if (!text) return null;
  const wantsLookup = /\b(find|search|look\s*up|check|get|where is|do you have|does (he|she|they) have)\b/i.test(text)
    || /\b(email|phone|number|contact|address)\b/i.test(text);
  if (!wantsLookup) return null;
  const personLookup = /\b(who is|find me|look\s*up)\b/i.test(text)
    || /\b(person|people|contact|name)\b/i.test(text);
  if (personLookup) {
    return (
      'Person lookup: contacts(action="search") first with the exact spelling they gave. '
      + 'Close spellings may match (Apigey ≈ Appiah). List multiple matches; never invent a different person. '
      + 'Do not open Documents for a person name hunt.'
    );
  }
  return (
    'Search escalation: internal sources first (contacts, email, Drive, docs, memory, chat), '
    + 'then expand until found. Do not stop after one empty source. Do not ask what "internal" means.'
  );
}

/**
 * Detect standing "next time..." search / behaviour preferences worth auto-saving.
 */
export function extractSearchEscalationPreference(message: string): string | null {
  const text = message.trim();
  if (!text) return null;
  if (!/\bnext time\b/i.test(text) && !/\bfrom now on\b/i.test(text) && !/\balways\b.+\b(search|find|check)\b/i.test(text)) {
    return null;
  }
  if (!/\b(search|find|check|look|proactive|do not stop|don't stop|any means|internal)\b/i.test(text)) {
    return null;
  }
  return (
    'When looking something up: start with known internal workspace sources '
    + '(contacts, email, Drive, documents, memory, chat), then expand to other internal tools, '
    + 'then the open web if needed. Do not stop after one empty source. Do not ask clarifying '
    + 'questions about what internal means; just escalate until found or all reasonable sources are exhausted.'
  );
}
