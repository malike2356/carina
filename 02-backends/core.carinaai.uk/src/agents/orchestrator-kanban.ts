import type { TaskPlan } from '../types/index.js';
import { addCard } from './kanban-store.js';
import { runCardWork } from './kanban-service.js';
import { dispatchWebhook } from '../webhooks/dispatcher.js';
import { triggerTaskFlowsForEvent } from '../ops/taskflows/engine.js';
import { taskFlowsEnabled } from '../ops/taskflows/store.js';

export async function decomposePlanToKanban(
  sessionId: string,
  originalTask: string,
  plan: TaskPlan,
  boardId = 'default',
): Promise<string[]> {
  const cardIds: string[] = [];
  for (const [idx, step] of plan.steps.entries()) {
    const card = await addCard({
      sessionId,
      boardId,
      title: step.description.slice(0, 200) || `Step ${idx + 1}`,
      description: `From orchestrator decomposition.\n\nOriginal task: ${originalTask.slice(0, 500)}`,
      workPrompt: step.description,
      column: 'backlog',
      priority: plan.steps.length - idx,
      targetRole: 'worker',
      orchestratorNotes: `lane=${idx};dependsOn=${step.dependsOn.join(',')}`,
    });
    cardIds.push(card.id);
  }
  return cardIds;
}

export async function runParallelKanbanLanes(
  sessionId: string,
  cardIds: string[],
  maxConcurrent?: number,
): Promise<Array<{ cardId: string; summary: string; error?: string }>> {
  const poolSize = maxConcurrent ?? Number(process.env.CARINA_KANBAN_LANE_POOL ?? 3);
  const slots = Math.max(1, Math.min(poolSize, cardIds.length));
  const results: Array<{ cardId: string; summary: string; error?: string }> = [];

  let cursor = 0;
  async function worker() {
    while (cursor < cardIds.length) {
      const cardId = cardIds[cursor++]!;
      try {
        const { summary } = await runCardWork(sessionId, cardId);
        results.push({ cardId, summary });
        void emitKanbanWorkerFeedback(cardId, sessionId, summary, 'review');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ cardId, summary: '', error: msg });
        void emitKanbanWorkerFeedback(cardId, sessionId, msg, 'backlog');
      }
    }
  }

  await Promise.all(Array.from({ length: slots }, () => worker()));
  return results;
}

export async function emitKanbanWorkerFeedback(
  cardId: string,
  sessionId: string,
  summary: string,
  column: string,
): Promise<void> {
  const payload = { card_id: cardId, session_id: sessionId, column, summary: summary.slice(0, 2000) };
  void dispatchWebhook('kanban.move', payload);
  if (taskFlowsEnabled()) {
    const event = column === 'review' ? 'kanban.review' : 'kanban.move';
    triggerTaskFlowsForEvent(event, payload);
  }
}
