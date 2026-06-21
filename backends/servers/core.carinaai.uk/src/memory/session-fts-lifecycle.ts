import { getSessionHistory } from './store.js';
import { buildFullText, indexSession } from './session-fts-indexer.js';
import { generateSessionTitle } from './session-titles.js';
import { callAuxiliaryModel } from '../brain/auxiliary-client.js';
import { currentProfileId } from './session-fts-db.js';

export async function indexEndedSession(
  sessionId: string,
  profileId?: string,
): Promise<void> {
  const messages = await getSessionHistory(sessionId, 200);
  if (messages.length === 0) return;

  const normalized = messages.map((m) => ({
    role: m.role ?? 'user',
    content: m.content,
  }));

  const firstUser = normalized.find((m) => m.role === 'user')?.content
    ?? normalized[0]?.content
    ?? sessionId;
  const title = await generateSessionTitle(firstUser);
  const fullText = buildFullText(normalized);

  let summary = '';
  try {
    summary = await callAuxiliaryModel(
      'summarization',
      `Summarize this conversation in one sentence:\n${fullText.slice(0, 2000)}`,
    );
  } catch {
    summary = '';
  }

  const createdAt = messages[0]?.createdAt?.getTime() ?? Date.now();
  const updatedAt = messages.at(-1)?.createdAt?.getTime() ?? Date.now();

  indexSession({
    sessionId,
    title,
    summary,
    fullText,
    createdAt,
    updatedAt,
    profileId: profileId ?? currentProfileId(),
  });
}
