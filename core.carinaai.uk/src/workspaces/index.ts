export type {
  AgentBinding,
  AgentBindingMatch,
  AgentDefinition,
  AgentToAgentPolicy,
  AgentsConfig,
  PeerKind,
  RoutingContext,
  RoutingResult,
} from './types.js';
export {
  activeAgentFile,
  agentSessionsDir,
  agentsConfigPath,
  defaultAgentDir,
  defaultWorkspacePath,
  resolveAgentDir,
  resolveAgentWorkspace,
} from './paths.js';
export { ensureAgentLayout } from './agent-bootstrap.js';
export {
  addBinding,
  agentToAgentPolicy,
  createAgentDefinition,
  deleteAgentDefinition,
  ensureAgentsConfig,
  getActiveAgentDefinition,
  getActiveAgentId,
  getAgentDefinition,
  getDefaultAgentDefinition,
  listAgentDefinitions,
  listBindings,
  loadAgentsConfig,
  removeBinding,
  saveAgentsConfig,
  setActiveAgentId,
} from './agent-registry.js';
export { describeRoute, resolveAgentRoute } from './agent-routing.js';
export {
  applyAgentRuntimeEnv,
  buildAgentRuntimeContext,
  clearAgentRuntimeEnv,
  type AgentRuntimeContext,
} from './agent-context.js';
