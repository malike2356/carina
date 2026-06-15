import type { Tool } from '../types/index.js';
import {
  browseRecentSessions,
  scrollSessionMessages,
  searchSessionsAdvanced,
} from '../memory/session-index.js';
import { searchMemoryScope } from '../memory/session-scope.js';
import { getLineageRoot, getSessionChain, lineageRelatedSessionIds } from '../memory/session-lineage.js';

export const sessionSearchTool: Tool = {
  name: 'session-search',
  description:
    'Search past conversation history. Use this BEFORE claiming you do not remember something - search first. Also use it when the user references prior work ("last time", "previously", "do you remember"). Modes: query (find sessions by content), scroll (paginate messages in a session, including lineage continuations), browse (list recent sessions with no query). Scroll supports around_message_id, cursor + direction (older|newer), and include_lineage to read parent session tail.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query (supports OR, quoted phrases, -exclude)' },
      session_id: { type: 'string', description: 'Session ID for scroll mode' },
      around_message_id: { type: 'string', description: 'Anchor message ID for scroll mode' },
      cursor: { type: 'string', description: 'Message ID cursor for paginated scroll' },
      direction: { type: 'string', enum: ['older', 'newer'], description: 'Scroll direction when using cursor' },
      include_lineage: { type: 'boolean', description: 'Include parent session messages when scrolling to older at chain boundary' },
      limit: { type: 'number', description: 'Max results (default 5 discovery, 20 scroll)' },
      offset: { type: 'number', description: 'Pagination offset (discovery mode)' },
      page: { type: 'number', description: 'Page number (1-based, discovery mode)' },
      sort: { type: 'string', enum: ['relevance', 'newest', 'oldest'], description: 'Result ordering' },
      role_filter: { type: 'string', enum: ['user', 'assistant'] },
      semantic: { type: 'boolean', description: 'Blend embedding similarity when available (default true)' },
    },
  },
  execute: async (params) => {
    const query = params.query ? String(params.query) : '';
    const sessionId = params.session_id ? String(params.session_id) : '';
    const aroundId = params.around_message_id ? String(params.around_message_id) : '';
    const cursor = params.cursor ? String(params.cursor) : '';
    const direction = params.direction === 'newer' ? 'newer' : 'older';
    const includeLineage = params.include_lineage === true;
    const scrollLimit = params.limit ? Number(params.limit) : 20;
    const limit = params.limit ? Number(params.limit) : 5;
    const page = params.page ? Number(params.page) : undefined;
    const offset = page && page > 0
      ? (page - 1) * limit
      : (params.offset ? Number(params.offset) : 0);

    if (sessionId) {
      try {
        const pageResult = await scrollSessionMessages(sessionId, {
          around: aroundId || undefined,
          cursor: !aroundId && cursor ? cursor : undefined,
          direction,
          limit: Math.min(scrollLimit, 100),
          includeLineage,
        });
        return {
          mode: 'scroll',
          sessionId,
          messages: pageResult.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            createdAt: m.createdAt,
          })),
          hasOlder: pageResult.hasOlder,
          hasNewer: pageResult.hasNewer,
          oldestMessageId: pageResult.oldestMessageId,
          newestMessageId: pageResult.newestMessageId,
          lineage: pageResult.lineage
            ? {
                rootSessionId: pageResult.lineage.rootSessionId,
                chain: pageResult.lineage.chain,
                crossedFromParent: pageResult.lineage.crossedFromParent,
                parentSessionId: pageResult.lineage.parentSessionId,
              }
            : undefined,
          nextCursor: pageResult.hasOlder ? pageResult.oldestMessageId : null,
        };
      } catch (err) {
        console.error('session-search scroll failed:', err);
        return { error: 'Session scroll failed.' };
      }
    }

    if (query) {
      try {
        const payload = await searchSessionsAdvanced({
          query,
          limit: Math.min(limit, 50),
          offset,
          sort: params.sort === 'newest' || params.sort === 'oldest' ? params.sort : 'relevance',
          roleFilter: params.role_filter ? String(params.role_filter) : undefined,
          enableSemantic: params.semantic !== false,
          tenantScope: searchMemoryScope(),
        });
        return {
          mode: 'discovery',
          query,
          sort: payload.sort,
          page: payload.page,
          total: payload.total,
          totalPages: payload.totalPages,
          strategy: payload.strategy,
          fallbackUsed: payload.fallbackUsed,
          indexHealthy: payload.indexHealthy,
          results: payload.results.map((r) => ({
            ...r,
            lineageRoot: getLineageRoot(r.sessionId),
            lineageChain: getSessionChain(r.sessionId),
            relatedSessionIds: lineageRelatedSessionIds(r.sessionId),
          })),
        };
      } catch (err) {
        console.error('session-search discovery failed:', err);
        return { error: 'Session search failed.' };
      }
    }

    try {
      const recent = await browseRecentSessions(limit, searchMemoryScope());
      return { mode: 'browse', results: recent };
    } catch (err) {
      console.error('session-search browse failed:', err);
      return { error: 'Session browse failed.' };
    }
  },
};
