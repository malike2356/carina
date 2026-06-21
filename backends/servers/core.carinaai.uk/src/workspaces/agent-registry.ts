import fs from 'fs';
import fsPromises from 'fs/promises';
import { CARINA_HOME } from '../config/paths.js';
import { ensureAgentLayout } from './agent-bootstrap.js';
import {
  activeAgentFile,
  agentsConfigPath,
  defaultAgentDir,
  defaultWorkspacePath,
} from './paths.js';
import type { AgentBinding, AgentDefinition, AgentsConfig } from './types.js';

const CONFIG_VERSION = 1;

function defaultConfig(homeDir = CARINA_HOME): AgentsConfig {
  const main: AgentDefinition = {
    id: 'main',
    name: 'Main',
    default: true,
    workspace: defaultWorkspacePath('main', homeDir),
    agentDir: defaultAgentDir('main', homeDir),
    description: 'Default Carina agent workspace',
  };
  return {
    version: CONFIG_VERSION,
    agents: [main],
    bindings: [
      { agentId: 'main', match: { channel: '*' }, label: 'default fallback' },
    ],
    tools: { agentToAgent: { enabled: false, allow: [] } },
    learning: { shareAcrossAgents: { mode: 'kernel', minSuccessCount: 2 } },
  };
}

export function loadAgentsConfig(homeDir = CARINA_HOME): AgentsConfig {
  const file = agentsConfigPath(homeDir);
  if (!fs.existsSync(file)) {
    return defaultConfig(homeDir);
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as AgentsConfig;
    if (!Array.isArray(raw.agents) || raw.agents.length === 0) {
      return defaultConfig(homeDir);
    }
    return {
      version: raw.version ?? CONFIG_VERSION,
      agents: raw.agents,
      bindings: raw.bindings ?? [],
      tools: raw.tools ?? { agentToAgent: { enabled: false, allow: [] } },
    };
  } catch {
    return defaultConfig(homeDir);
  }
}

export async function saveAgentsConfig(config: AgentsConfig, homeDir = CARINA_HOME): Promise<void> {
  await fsPromises.mkdir(homeDir, { recursive: true });
  await fsPromises.writeFile(
    agentsConfigPath(homeDir),
    JSON.stringify({ ...config, version: CONFIG_VERSION }, null, 2),
    'utf-8',
  );
}

export async function ensureAgentsConfig(homeDir = CARINA_HOME): Promise<AgentsConfig> {
  const file = agentsConfigPath(homeDir);
  let config = loadAgentsConfig(homeDir);
  if (!fs.existsSync(file)) {
    await saveAgentsConfig(config, homeDir);
  }
  for (const agent of config.agents) {
    await ensureAgentLayout(agent, homeDir);
  }
  return config;
}

export function listAgentDefinitions(homeDir = CARINA_HOME): AgentDefinition[] {
  return loadAgentsConfig(homeDir).agents;
}

export function getAgentDefinition(agentId: string, homeDir = CARINA_HOME): AgentDefinition | null {
  return loadAgentsConfig(homeDir).agents.find((a) => a.id === agentId) ?? null;
}

export function getDefaultAgentDefinition(homeDir = CARINA_HOME): AgentDefinition {
  const config = loadAgentsConfig(homeDir);
  return config.agents.find((a) => a.default)
    ?? config.agents[0]
    ?? defaultConfig(homeDir).agents[0]!;
}

export function getActiveAgentId(homeDir = CARINA_HOME): string | null {
  try {
    const raw = fs.readFileSync(activeAgentFile(homeDir), 'utf-8').trim();
    return raw || null;
  } catch {
    return null;
  }
}

export function getActiveAgentDefinition(homeDir = CARINA_HOME): AgentDefinition {
  const activeId = getActiveAgentId(homeDir);
  if (activeId) {
    const found = getAgentDefinition(activeId, homeDir);
    if (found) return found;
  }
  return getDefaultAgentDefinition(homeDir);
}

export function setActiveAgentId(agentId: string, homeDir = CARINA_HOME): AgentDefinition {
  const agent = getAgentDefinition(agentId, homeDir);
  if (!agent) throw new Error(`Unknown agent: ${agentId}`);
  fs.mkdirSync(homeDir, { recursive: true });
  fs.writeFileSync(activeAgentFile(homeDir), agentId, 'utf-8');
  process.env.CARINA_ACTIVE_AGENT = agentId;
  process.env.CARINA_AGENT_WORKSPACE = agent.workspace;
  return agent;
}

export async function createAgentDefinition(
  input: Pick<AgentDefinition, 'id' | 'name'> & Partial<AgentDefinition>,
  homeDir = CARINA_HOME,
): Promise<AgentDefinition> {
  const id = input.id.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
  if (!id) throw new Error('Invalid agent id');

  const config = await ensureAgentsConfig(homeDir);
  if (config.agents.some((a) => a.id === id)) {
    throw new Error(`Agent already exists: ${id}`);
  }

  const agent: AgentDefinition = {
    id,
    name: input.name || id,
    default: input.default ?? false,
    workspace: input.workspace ?? defaultWorkspacePath(id, homeDir),
    agentDir: input.agentDir ?? defaultAgentDir(id, homeDir),
    provider: input.provider,
    model: input.model,
    skillPacks: input.skillPacks ?? [],
    description: input.description,
  };

  if (agent.default) {
    for (const existing of config.agents) existing.default = false;
  }

  config.agents.push(agent);
  await saveAgentsConfig(config, homeDir);
  await ensureAgentLayout(agent, homeDir);
  return agent;
}

export async function deleteAgentDefinition(agentId: string, homeDir = CARINA_HOME): Promise<boolean> {
  const config = loadAgentsConfig(homeDir);
  const before = config.agents.length;
  config.agents = config.agents.filter((a) => a.id !== agentId);
  config.bindings = config.bindings.filter((b) => b.agentId !== agentId);
  if (config.agents.length === before) return false;
  if (!config.agents.some((a) => a.default) && config.agents[0]) {
    config.agents[0].default = true;
  }
  await saveAgentsConfig(config, homeDir);
  return true;
}

export function listBindings(homeDir = CARINA_HOME): AgentBinding[] {
  return loadAgentsConfig(homeDir).bindings;
}

export async function addBinding(binding: AgentBinding, homeDir = CARINA_HOME): Promise<void> {
  const config = loadAgentsConfig(homeDir);
  if (!getAgentDefinition(binding.agentId, homeDir)) {
    throw new Error(`Unknown agent: ${binding.agentId}`);
  }
  config.bindings.unshift(binding);
  await saveAgentsConfig(config, homeDir);
}

export async function removeBinding(index: number, homeDir = CARINA_HOME): Promise<boolean> {
  const config = loadAgentsConfig(homeDir);
  if (index < 0 || index >= config.bindings.length) return false;
  config.bindings.splice(index, 1);
  await saveAgentsConfig(config, homeDir);
  return true;
}

export function agentToAgentPolicy(homeDir = CARINA_HOME) {
  return loadAgentsConfig(homeDir).tools?.agentToAgent ?? { enabled: false, allow: [] };
}
