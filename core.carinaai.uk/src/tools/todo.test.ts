import { describe, expect, it, beforeEach } from 'vitest';
import { createTodoTool, getSessionTodos, clearSessionTodos } from './todo.js';

const SESSION = 'test-session';
const SESSION_B = 'other-session';

describe('todo tool', () => {
  beforeEach(() => {
    clearSessionTodos(SESSION);
    clearSessionTodos(SESSION_B);
  });

  it('read returns empty list when no todos exist', async () => {
    const tool = createTodoTool(SESSION);
    const result = await tool.execute({ action: 'read' }) as { todos: unknown[]; count: number };
    expect(result.todos).toEqual([]);
    expect(result.count).toBe(0);
  });

  it('write replace mode replaces all', async () => {
    const tool = createTodoTool(SESSION);
    await tool.execute({ todos: [{ id: '1', content: 'Task A', status: 'pending' }], merge: false });
    const result = await tool.execute({
      todos: [{ id: '2', content: 'Task B', status: 'in_progress' }],
      merge: false,
    }) as { todos: Array<{ id: string }>; mode: string };
    expect(result.mode).toBe('replaced');
    expect(result.todos).toHaveLength(1);
    expect(result.todos[0].id).toBe('2');
  });

  it('write merge=true updates existing by id and preserves others', async () => {
    const tool = createTodoTool(SESSION);
    await tool.execute({
      todos: [
        { id: '1', content: 'Step one', status: 'pending' },
        { id: '2', content: 'Step two', status: 'pending' },
      ],
      merge: false,
    });
    await tool.execute({ todos: [{ id: '1', content: 'Step one', status: 'in_progress' }], merge: true });
    const todos = getSessionTodos(SESSION);
    expect(todos).toHaveLength(2);
    expect(todos.find((t) => t.id === '1')?.status).toBe('in_progress');
    expect(todos.find((t) => t.id === '2')?.status).toBe('pending');
  });

  it('read returns current todos after write', async () => {
    const tool = createTodoTool(SESSION);
    await tool.execute({ todos: [{ id: '1', content: 'Task A', status: 'completed' }], merge: false });
    const result = await tool.execute({ action: 'read' }) as { todos: Array<{ id: string }>; count: number };
    expect(result.todos).toHaveLength(1);
    expect(result.todos[0].id).toBe('1');
    expect(result.count).toBe(1);
  });

  it('defaults action to write when omitted', async () => {
    const tool = createTodoTool(SESSION);
    const result = await tool.execute({ todos: [{ id: '1', content: 'x', status: 'pending' }] }) as { mode: string };
    expect(result.mode).toBe('merged');
  });

  it('invalid status defaults to pending', async () => {
    const tool = createTodoTool(SESSION);
    await tool.execute({ todos: [{ id: '1', content: 'x', status: 'bogus' }], merge: false });
    expect(getSessionTodos(SESSION)[0].status).toBe('pending');
  });

  it('sessions are isolated - different sessionId different list', async () => {
    const toolA = createTodoTool(SESSION);
    const toolB = createTodoTool(SESSION_B);
    await toolA.execute({ todos: [{ id: '1', content: 'from A', status: 'pending' }], merge: false });
    await toolB.execute({ todos: [{ id: '2', content: 'from B', status: 'pending' }], merge: false });
    expect(getSessionTodos(SESSION)).toHaveLength(1);
    expect(getSessionTodos(SESSION)[0].id).toBe('1');
    expect(getSessionTodos(SESSION_B)).toHaveLength(1);
    expect(getSessionTodos(SESSION_B)[0].id).toBe('2');
  });
});
