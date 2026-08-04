import fs from 'fs/promises';
import path from 'path';
import { resolveCarinaHome } from '../../../config/paths.js';
import { DEFAULT_CLI_CONFIG, type ProviderName } from '../../../cli/config/defaults.js';
import { writeConfig } from '../../../cli/config/loader.js';
import { ONBOARDING_DONE_KEY } from '../../../cli/first-run-onboarding.js';
import {
  mergeEnvLines,
  persistProviderBootstrap,
  ensureOperatorMemoryEnv,
} from '../../../cli/provider-bootstrap.js';
import { seedWorkspaceFromProfile } from '../../../setup/workspace-seed.js';
import {
  ensureAgentsConfig,
  saveAgentsConfig,
} from '../../../workspaces/agent-registry.js';
import { resolveAgentWorkspace } from '../../../workspaces/paths.js';
import { SOUL_SNIPPETS } from './copy.js';
import type { OnboardingState, PersonalityPreset } from './types.js';

function isKnownCliProvider(provider: string): provider is ProviderName {
  return provider === 'deepseek' || provider === 'anthropic' || provider === 'openai' || provider === 'gemini';
}

async function applyWorkspaceName(name: string | null, home = resolveCarinaHome()): Promise<void> {
  if (!name?.trim()) return;
  const config = await ensureAgentsConfig(home);
  const main = config.agents.find((a) => a.default) ?? config.agents[0];
  if (!main) return;
  main.name = name.trim();
  await saveAgentsConfig(config, home);
}

async function seedPersonalityVoice(
  preset: PersonalityPreset | null,
  home = resolveCarinaHome(),
): Promise<void> {
  if (!preset || preset === 'custom') return;
  const snippet = SOUL_SNIPPETS[preset];
  const config = await ensureAgentsConfig(home);
  const agent = config.agents.find((a) => a.default) ?? config.agents[0];
  if (!agent) return;

  const soulPath = path.join(resolveAgentWorkspace(agent), 'SOUL.md');
  let existing = '';
  try {
    existing = await fs.readFile(soulPath, 'utf-8');
  } catch {
    existing = '';
  }

  if (existing.includes('Be genuinely helpful, not performatively helpful.')) {
    await fs.writeFile(soulPath, snippet, 'utf-8');
  }
}

export async function persistInkOnboardingState(state: OnboardingState): Promise<void> {
  const home = resolveCarinaHome();
  await fs.mkdir(home, { recursive: true });

  const operatorName = state.workspaceName?.trim() || 'Operator';
  const sharedLines = [
    `CARINA_OPERATOR_NAME=${operatorName}`,
    `${ONBOARDING_DONE_KEY}=true`,
  ];

  if (state.personality) {
    sharedLines.push(`CARINA_VOICE_PRESET=${state.personality}`);
  }
  if (state.homeDir && state.homeDir !== home) {
    sharedLines.push(`CARINA_HOME=${state.homeDir}`);
  }
  if (state.tourChoice === 'later') {
    sharedLines.push('CARINA_TOUR_REMINDER=true');
  }

  if (state.provider && state.apiKey && state.model) {
    if (isKnownCliProvider(state.provider)) {
      await persistProviderBootstrap(
        {
          provider: state.provider,
          model: state.model,
          apiKey: state.apiKey,
        },
        sharedLines,
      );
    } else if (state.provider === 'gemini') {
      await writeConfig({ ...DEFAULT_CLI_CONFIG });
      await mergeEnvLines([
        ...sharedLines,
        `GEMINI_API_KEY=${state.apiKey}`,
        `GEMINI_MODEL=${state.model}`,
        `DEFAULT_MODEL=${state.model}`,
        `DEFAULT_PROVIDER=gemini`,
      ]);
    } else if (state.provider === 'groq') {
      await writeConfig({ ...DEFAULT_CLI_CONFIG });
      await mergeEnvLines([
        ...sharedLines,
        `GROQ_API_KEY=${state.apiKey}`,
        `GROQ_MODEL=${state.model}`,
        `DEFAULT_MODEL=${state.model}`,
        `DEFAULT_PROVIDER=groq`,
      ]);
    }
  } else {
    await writeConfig({ ...DEFAULT_CLI_CONFIG });
    await mergeEnvLines(sharedLines);
  }

  await ensureOperatorMemoryEnv();

  process.env.CARINA_OPERATOR_NAME = operatorName;
  await applyWorkspaceName(state.workspaceName, home);
  await seedPersonalityVoice(state.personality, home);
  await seedWorkspaceFromProfile(home);
}
