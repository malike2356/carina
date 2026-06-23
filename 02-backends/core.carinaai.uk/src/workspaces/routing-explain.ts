import { describeRoute, resolveAgentRoute } from './agent-routing.js';
import type { AgentsConfig, RoutingContext, RoutingResult } from './types.js';
import { loadAgentsConfig } from './agent-registry.js';

export const ROUTING_PRECEDENCE = [
  'ownership (thread already owned by an agent)',
  'contact (contactId match)',
  'peer (direct or group peer id)',
  'guild (Discord guild)',
  'team (Slack or Microsoft team)',
  'account (channel account id)',
  'channel (channel name only)',
  'default (fallback binding or main agent)',
] as const;

export type RouteExplanation = {
  context: RoutingContext;
  result: RoutingResult;
  description: string;
  precedence: readonly string[];
};

export function buildRouteExplanation(
  ctx: RoutingContext,
  config: AgentsConfig = loadAgentsConfig(),
): RouteExplanation {
  const result = resolveAgentRoute(ctx, config);
  return {
    context: ctx,
    result,
    description: describeRoute(ctx, config),
    precedence: ROUTING_PRECEDENCE,
  };
}
