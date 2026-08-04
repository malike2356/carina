import { AsyncLocalStorage } from 'node:async_hooks';
import type { OrgRole } from '../hosted/org-types.js';
import type { AgentClaim } from './behavior-proof.js';

export interface ToolExecutionContext {
  orgRole?: OrgRole;
  planMode?: boolean;
  claims?: AgentClaim[];
}

export const toolExecutionContext = new AsyncLocalStorage<ToolExecutionContext>();

export function getToolExecutionContext(): ToolExecutionContext {
  return toolExecutionContext.getStore() ?? {};
}

export function runWithToolExecutionContext<T>(ctx: ToolExecutionContext, fn: () => T): T {
  return toolExecutionContext.run(ctx, fn);
}

export function runWithToolExecutionContextAsync<T>(
  ctx: ToolExecutionContext,
  fn: () => Promise<T>,
): Promise<T> {
  return toolExecutionContext.run(ctx, fn);
}
