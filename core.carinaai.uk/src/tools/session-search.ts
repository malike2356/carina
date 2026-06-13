import type { Tool } from '../types/index.js';
import {
  browseRecentSessions,
  getSessionWindow,
  searchSessions,
} from '../memory/session-index.js';

export const sessionSearchTool: Tool = {
  name: 'session-search',
  description:
    'Search past conversation history. Use this BEFORE claiming you do not remember something - search first. Also use it when the user references prior work ("last time", "previously", "do you remember"). Modes: query (find sessions by content), scroll (read context around a message), browse (list recent sessions with no query).',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query (supports OR, quoted phrases, -exclude)' },
      session_id: { type: 'string', description: 'Session ID for scroll mode' },
      around_message_id: { type: 'string', description: 'Anchor message ID for scroll mode' },
      limit: { type: 'number', description: 'Max results (default 5)' },
      role_filter: { type: 'string', enum: ['user', 'assistant'] },
    },
  },
  execute: async (params) => {
    const query = params.query ? String(params.query) : '';
    const sessionId = params.session_id ? String(params.session_id) : '';
    const aroundId = params.around_message_id ? String(params.around_message_id) : '';
    const limit = params.limit ? Number(params.limit) : 5;

    if (sessionId && aroundId) {
      try {
        const window = await getSessionWindow(sessionId, aroundId, 5);
        return {
          mode: 'scroll',
          sessionId,
          messages: window.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            createdAt: m.createdAt,
          })),
        };
      } catch (err) {
        console.error('session-search scroll failed:', err);
        return { error: 'Session scroll failed.' };
      }
    }

    if (query) {
      try {
        const hits = await searchSessions(query, {
          limit,
          roleFilter: params.role_filter ? String(params.role_filter) : undefined,
        });
        return { mode: 'discovery', query, results: hits };
      } catch (err) {
        console.error('session-search discovery failed:', err);
        return { error: 'Session search failed.' };
      }
    }

    try {
      const recent = await browseRecentSessions(limit);
      return { mode: 'browse', results: recent };
    } catch (err) {
      console.error('session-search browse failed:', err);
      return { error: 'Session browse failed.' };
    }
  },
};
