import { callAuxiliaryModel } from '../brain/auxiliary-client.js';

export interface SessionSearchSummaryInput {
  sessionId: string;
  snippet: string;
}

export async function summarizeSessionSearchResults(
  query: string,
  rawResults: SessionSearchSummaryInput[],
): Promise<string> {
  if (rawResults.length === 0) return 'No matching past conversations found.';
  const context = rawResults
    .slice(0, 5)
    .map((r) => `[${r.sessionId.slice(0, 8)}] ${r.snippet}`)
    .join('\n');

  try {
    return await callAuxiliaryModel(
      'sessionSearch',
      `Query: "${query}"\n\nRelevant past conversations:\n${context}\n\nSummarize what was found in 2-3 sentences.`,
    );
  } catch {
    const count = rawResults.length;
    return `Found ${count} past conversation${count === 1 ? '' : 's'} related to "${query}".`;
  }
}
