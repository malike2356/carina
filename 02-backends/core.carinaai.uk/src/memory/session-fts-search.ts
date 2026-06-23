import type Database from 'better-sqlite3';
import { callAuxiliaryModel } from '../brain/auxiliary-client.js';
import { currentProfileId, getSessionFtsDb } from './session-fts-db.js';

export interface SessionFtsSearchResult {
  sessionId: string;
  title: string;
  snippet: string;
  rank: number;
  createdAt: number;
}

export function sanitizeFtsQuery(query: string): string {
  return query
    .replace(/['"*^{}]/g, ' ')
    .replace(/-/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}

export function searchSessionsFts5(
  query: string,
  opts: { profileId?: string; limit?: number } = {},
): SessionFtsSearchResult[] {
  const sanitized = sanitizeFtsQuery(query);
  if (!sanitized) return [];

  const db = getSessionFtsDb() as Database.Database;
  const limit = opts.limit ?? 10;
  const profileId = opts.profileId ?? currentProfileId();

  const rows = db.prepare(`
    SELECT
      session_id,
      title,
      snippet(session_fts, 2, '[', ']', '...', 20) AS snippet,
      rank,
      created_at,
      profile_id
    FROM session_fts
    WHERE session_fts MATCH ?
      AND profile_id = ?
    ORDER BY rank
    LIMIT ?
  `).all(sanitized, profileId, limit) as Array<{
    session_id: string;
    title: string;
    snippet: string;
    rank: number;
    created_at: number;
    profile_id: string;
  }>;

  return rows.map((r) => ({
    sessionId: r.session_id,
    title: r.title ?? '',
    snippet: r.snippet ?? '',
    rank: r.rank,
    createdAt: r.created_at,
  }));
}

export async function recallAcrossSessions(
  query: string,
  profileId?: string,
): Promise<string> {
  const results = searchSessionsFts5(query, { profileId, limit: 5 });

  if (results.length === 0) {
    return `No past sessions found matching "${query}".`;
  }

  const context = results
    .map((r) => `Session "${r.title}" (${new Date(r.createdAt).toLocaleDateString()}): ${r.snippet}`)
    .join('\n\n');

  try {
    return await callAuxiliaryModel(
      'sessionSearch',
      `The user asked: "${query}"

Relevant past conversations:
${context}

Summarize what was discussed in 2-3 sentences. Be specific about dates and topics.`,
    );
  } catch {
    return results.map((r) => `[${r.title}] ${r.snippet}`).join('\n');
  }
}
