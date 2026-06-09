import type { Tool } from '../types/index.js';

export type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface TodoItem {
  id: string;
  content: string;
  status: TodoStatus;
}

const sessionTodos = new Map<string, TodoItem[]>();

export function getSessionTodos(sessionId: string): TodoItem[] {
  return sessionTodos.get(sessionId) ?? [];
}

export function clearSessionTodos(sessionId: string): void {
  sessionTodos.delete(sessionId);
}

function parseStatus(value: unknown): TodoStatus {
  const s = String(value ?? 'pending');
  if (s === 'in_progress' || s === 'completed' || s === 'cancelled') return s;
  return 'pending';
}

export function createTodoTool(sessionId: string): Tool {
  return {
    name: 'todo',
    description:
      'In-session task list. Pass todos array with id, content, status. Use merge=true to update existing, merge=false to replace all.',
    parameters: {
      type: 'object',
      properties: {
        todos: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              content: { type: 'string' },
              status: {
                type: 'string',
                enum: ['pending', 'in_progress', 'completed', 'cancelled'],
              },
            },
            required: ['id', 'content', 'status'],
          },
        },
        merge: { type: 'boolean', description: 'true = update existing, false = replace all' },
      },
      required: ['todos'],
    },
    execute: async (params) => {
      const incoming = (params.todos ?? []) as Array<{
        id: string;
        content: string;
        status: string;
      }>;
      const merge = params.merge !== false;

      const parsed: TodoItem[] = incoming.map((t) => ({
        id: String(t.id),
        content: String(t.content),
        status: parseStatus(t.status),
      }));

      if (!merge) {
        sessionTodos.set(sessionId, parsed);
        return { todos: parsed, mode: 'replaced' };
      }

      const existing = getSessionTodos(sessionId);
      const byId = new Map(existing.map((t) => [t.id, t]));
      for (const item of parsed) {
        byId.set(item.id, item);
      }
      const merged = [...byId.values()];
      sessionTodos.set(sessionId, merged);
      return { todos: merged, mode: 'merged' };
    },
  };
}
