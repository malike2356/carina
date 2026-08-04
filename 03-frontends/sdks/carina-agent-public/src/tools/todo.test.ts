import { describe, expect, it } from 'vitest';
import { createTodoTool, clearSessionTodos } from './todo.js';

describe('todo tool', () => {
  const sessionId = 'test-todo-session';

  it('replaces todos when merge is false', async () => {
    clearSessionTodos(sessionId);
    const tool = createTodoTool(sessionId);
    await tool.execute({
      todos: [{ id: '1', content: 'Task A', status: 'pending' }],
      merge: false,
    });
    const result = await tool.execute({
      todos: [{ id: '2', content: 'Task B', status: 'in_progress' }],
      merge: false,
    }) as { todos: Array<{ id: string }> };
    expect(result.todos).toHaveLength(1);
    expect(result.todos[0].id).toBe('2');
  });

  it('merges todos when merge is true', async () => {
    clearSessionTodos(sessionId);
    const tool = createTodoTool(sessionId);
    await tool.execute({
      todos: [{ id: '1', content: 'Task A', status: 'pending' }],
      merge: false,
    });
    const result = await tool.execute({
      todos: [{ id: '1', content: 'Task A', status: 'completed' }],
      merge: true,
    }) as { todos: Array<{ status: string }> };
    expect(result.todos[0].status).toBe('completed');
  });
});
