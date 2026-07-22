import 'server-only';

import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { chatMessages, type Workspace } from '@/db/schema';

export const FREE_PLATFORM_MESSAGE_LIMIT = Number.parseInt(
  process.env.FREE_PLATFORM_MESSAGE_LIMIT ?? '100',
  10,
);

const DEFAULT_MINI_PROVIDER = 'deepseek';
const DEFAULT_MINI_MODEL = 'deepseek-chat';

export type ChatAccessMode = 'platform' | 'byok' | 'mini';

export type ChatAccessPolicy = {
  mode: ChatAccessMode;
  freeMessagesUsed: number;
  freeMessagesLimit: number;
  provider?: string;
  model?: string;
  upgradeUrl: string;
  byokUrl: string;
};

export async function countWorkspaceUserMessages(workspaceId: string): Promise<number> {
  const [row] = await db
    .select({
      total: sql<number>`count(*)`,
    })
    .from(chatMessages)
    .where(and(eq(chatMessages.workspaceId, workspaceId), eq(chatMessages.role, 'user')));
  return Number(row?.total ?? 0);
}

export function isWorkspaceSubscribed(workspace: Workspace): boolean {
  return workspace.plan !== 'free' || Boolean(workspace.stripeSubscriptionId);
}

export async function resolveChatAccessPolicy(
  workspace: Workspace,
  hasByokKeys: boolean,
): Promise<ChatAccessPolicy> {
  const freeMessagesUsed = await countWorkspaceUserMessages(workspace.id);
  const base = {
    freeMessagesUsed,
    freeMessagesLimit: FREE_PLATFORM_MESSAGE_LIMIT,
    upgradeUrl: '/billing/aiva?subscribe=1',
    byokUrl: '/settings/keys',
  };

  if (hasByokKeys) {
    return { ...base, mode: 'byok' };
  }

  if (isWorkspaceSubscribed(workspace)) {
    return { ...base, mode: 'platform' };
  }

  if (freeMessagesUsed < FREE_PLATFORM_MESSAGE_LIMIT) {
    return { ...base, mode: 'platform' };
  }

  return {
    ...base,
    mode: 'mini',
    provider: process.env.FREE_FALLBACK_PROVIDER ?? DEFAULT_MINI_PROVIDER,
    model: process.env.FREE_FALLBACK_MODEL ?? DEFAULT_MINI_MODEL,
  };
}
