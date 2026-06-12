import { llm } from '../brain/llm.js';
import { classifyComplexity } from '../brain/task-classifier.js';
import { saveMemory } from '../memory/store.js';
import { evaluateAndWriteSkill } from '../skills/auto-writer.js';
import { getActiveProfileName } from '../profiles/manager.js';
import {
  classifyTurnBucket,
  hashUserMessage,
  recordTurn,
  type TurnLogEntry,
} from '../telemetry/turn-log.js';
import { CarinaAgent, type TurnEvent } from './carina.js';
import { CodingAgent } from './coding-agent.js';
import { CommunicationAgent } from './communication-agent.js';
import { FileAgent } from './file-agent.js';
import { ResearchAgent } from './research-agent.js';
import type { ConfirmFn } from './tool-runner.js';
import type { ProviderOverride } from '../brain/llm.js';
import type { AgentOptions, Message, SubAgentType, TaskPlan, TaskPlanStep } from '../types/index.js';

export type OrchestratorEvent =
  | TurnEvent
  | { type: 'status'; content: string };

const DECOMPOSE_PROMPT = `Analyse this task and decide how to execute it.

Task: {task}

If the task can be completed in a single agent turn (simple question, one action), respond:
{ "singleAgent": true, "steps": [] }

If it needs multiple specialised steps, respond:
{
  "singleAgent": false,
  "steps": [
    {
      "description": "what this step does",
      "agentType": "research|coding|communication|file",
      "dependsOn": []
    }
  ]
}

Use agent types:
- research: fact-finding, web search, market data
- coding: scripts, calculations, automation
- communication: emails and outbound messages
- file: document organisation and reports

Steps with no dependencies can run in parallel. Use dependsOn as step indices (0-based).`;

export class CarinaOrchestrator {
  private agent: CarinaAgent;
  private sessionId: string;
  private memoryReady: boolean;
  private confirmTool?: ConfirmFn;
  private providerOverride?: ProviderOverride;
  private platform: string;

  constructor(
    sessionId: string,
    memoryReady: boolean,
    confirmTool?: ConfirmFn,
    options: AgentOptions = {},
  ) {
    this.sessionId = sessionId;
    this.memoryReady = memoryReady;
    this.confirmTool = confirmTool;
    this.platform = options.platform ?? 'cli';
    this.agent = new CarinaAgent(sessionId, memoryReady, confirmTool, options);
  }

  setSystemPromptSuffix(suffix: string): void {
    this.agent.setSystemPromptSuffix(suffix);
  }

  setProviderOverride(override: ProviderOverride): void {
    this.providerOverride = override;
    this.agent.setProviderOverride(override);
  }

  setTenantId(tenantId: string | undefined): void {
    this.agent.setTenantId(tenantId);
  }

  getProviderOverride(): ProviderOverride | undefined {
    return this.agent.getProviderOverride() ?? this.providerOverride;
  }

  private quickReply(userMessage: string): string | null {
    const text = userMessage.trim().toLowerCase();
    if (!text) return null;
    if (/^(hi|hello|hey|yo|good (morning|afternoon|evening))\b/.test(text)) {
      return 'Hi.';
    }
    if (/\bwhat can you do\b|\bhelp\b|\bcapabilit(y|ies)\b/.test(text)) {
      return 'Research, writing, coding, automation, planning, analysis, files, email, web, APIs.';
    }
    if (/\bwhich provider\b|\bwhat model\b|\bcurrent provider\b/.test(text)) {
      const preset = llm.getPreset();
      const presetNote = preset ? ` preset=${preset}` : '';
      return `Provider: ${llm.current().name} (${llm.currentModel()}).${presetNote}`;
    }
    if (/\bfree copilot\b|\bcopilot mode\b/.test(text)) {
      const selection = llm.copilotSelection();
      if (selection.order.length === 0) return selection.note;
      return `Free Copilot chain: ${selection.order.join(' -> ')}. ${selection.note}`;
    }
    return null;
  }

  async decompose(task: string): Promise<TaskPlan> {
    const messages: Message[] = [
      {
        role: 'user',
        content: DECOMPOSE_PROMPT.replace('{task}', task),
        timestamp: new Date(),
      },
    ];

    try {
      const response = await llm.chatCheap(messages);
      const parsed = parsePlanJson(response.content);
      if (parsed) return parsed;
    } catch {
      // fall through to heuristic
    }

    return heuristicPlan(task);
  }

  async *turn(userMessage: string): AsyncGenerator<OrchestratorEvent> {
    const started = Date.now();
    const logState: {
      path: TurnLogEntry['path'];
      complexity: TurnLogEntry['complexity'];
      fastMode: boolean;
      responseText: string;
      toolsUsed: string[];
      toolCallLog: string[];
      error?: string;
    } = {
      path: 'single',
      complexity: 'simple',
      fastMode: false,
      responseText: '',
      toolsUsed: [],
      toolCallLog: [],
    };

    try {
      const quick = this.quickReply(userMessage);
      if (quick) {
        logState.path = 'quick';
        logState.fastMode = true;
        logState.responseText = quick;
        yield { type: 'text', content: quick };
        return;
      }

      const complexity = classifyComplexity([
        { role: 'user', content: userMessage, timestamp: new Date() },
      ]);
      logState.complexity = complexity;
      const useFastMode = complexity === 'simple';
      logState.fastMode = useFastMode;
      this.agent.setFastMode(useFastMode);

      const plan = useFastMode
        ? { singleAgent: true, steps: [] }
        : await this.decompose(userMessage);

      if (plan.singleAgent || plan.steps.length === 0) {
        const toolsUsed: string[] = [];
        const toolCallLog: string[] = [];

        for await (const event of this.agent.turn(userMessage)) {
          yield event;
          if (event.type === 'tool') {
            const match = event.content.match(/\[using ([\w-]+)\.\.\.\]/);
            if (match) toolsUsed.push(match[1]!);
          }
        }

        const last = this.agent.getLastTurn();
        toolsUsed.push(...last.toolsUsed);
        toolCallLog.push(...last.toolCallLog);
        logState.responseText = last.text;
        logState.toolsUsed = [...new Set(toolsUsed)];
        logState.toolCallLog = toolCallLog;

        if (this.memoryReady) {
          await evaluateAndWriteSkill({
            userMessage,
            response: last.text,
            toolsUsed: logState.toolsUsed,
            toolCallLog,
            multiStep: false,
          });
        }
        return;
      }

      logState.path = 'multi';
      const stepOutputs = new Map<number, string>();
      const pending = new Set(plan.steps.map((_, i) => i));

      while (pending.size > 0) {
        const ready = [...pending].filter((idx) =>
          plan.steps[idx]!.dependsOn.every((dep) => stepOutputs.has(dep)),
        );

        if (ready.length === 0) {
          throw new Error('Task plan has circular or unsatisfiable dependencies.');
        }

        for (const idx of ready) {
          pending.delete(idx);
          const step = plan.steps[idx]!;
          yield {
            type: 'status',
            content: `[${step.agentType} agent working...]\n`,
          };
        }

        await Promise.all(
          ready.map(async (idx) => {
            const step = plan.steps[idx]!;
            const context = buildStepContext(step, stepOutputs);
            const result = await this.runStep(step, userMessage, context);
            stepOutputs.set(idx, result);
          }),
        );
      }

      yield { type: 'status', content: '[synthesising...]\n' };

      const synthesisPrompt = buildSynthesisPrompt(userMessage, stepOutputs);
      let finalText = '';

      for await (const event of this.agent.turn(synthesisPrompt)) {
        yield event;
        if (event.type === 'text') finalText += event.content;
      }

      const last = this.agent.getLastTurn();
      finalText = last.text || finalText;
      logState.responseText = finalText;
      logState.toolsUsed = last.toolsUsed;
      logState.toolCallLog = last.toolCallLog;

      if (this.memoryReady) {
        await saveMemory(this.sessionId, 'user', userMessage);
        await saveMemory(this.sessionId, 'assistant', finalText);
        await evaluateAndWriteSkill({
          userMessage,
          response: finalText,
          toolsUsed: last.toolsUsed,
          toolCallLog: last.toolCallLog,
          multiStep: true,
        });
      }
    } catch (err) {
      logState.error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      this.agent.setFastMode(false);
      try {
        const latencyMs = Date.now() - started;
        const toolErrors = countToolErrors(logState.toolCallLog);
        const provider = llm.current().name;
        const model = typeof llm.currentModel === 'function' ? llm.currentModel() : '';
        void recordTurn({
          sessionId: this.sessionId,
          profile: process.env.CARINA_PROFILE ?? getActiveProfileName() ?? 'default',
          platform: this.platform,
          provider,
          model,
          latencyMs,
          fastMode: logState.fastMode,
          complexity: logState.complexity,
          path: logState.path,
          toolsUsed: logState.toolsUsed,
          toolErrors,
          userMessageHash: hashUserMessage(userMessage),
          messageLength: userMessage.length,
          responseLength: logState.responseText.length,
          bucket: classifyTurnBucket({
            latencyMs,
            toolErrors,
            responseText: logState.responseText,
            responseLength: logState.responseText.length,
          }),
          error: logState.error,
        });
      } catch {
        // Telemetry must never affect chat turns.
      }
    }
  }

  private async runStep(
    step: TaskPlanStep,
    originalTask: string,
    context: string,
  ): Promise<string> {
    const sub = createSubAgent(step.agentType, this.sessionId, this.confirmTool, this.providerOverride);
    const prompt = `Original task: ${originalTask}\n\nYour step: ${step.description}`;
    return sub.run(prompt, context);
  }

  async clear(): Promise<void> {
    await this.agent.clear();
  }

  async recall(limit: number) {
    return this.agent.recall(limit);
  }
}

function createSubAgent(
  type: SubAgentType,
  sessionId: string,
  confirmTool?: ConfirmFn,
  providerOverride?: ProviderOverride,
) {
  switch (type) {
    case 'research':
      return new ResearchAgent(sessionId, confirmTool, providerOverride);
    case 'coding':
      return new CodingAgent(sessionId, confirmTool, providerOverride);
    case 'communication':
      return new CommunicationAgent(sessionId, confirmTool, providerOverride);
    case 'file':
      return new FileAgent(sessionId, confirmTool, providerOverride);
    default:
      return new ResearchAgent(sessionId, confirmTool, providerOverride);
  }
}

function buildStepContext(step: TaskPlanStep, outputs: Map<number, string>): string {
  if (step.dependsOn.length === 0) return '';
  const parts = step.dependsOn.map(
    (idx) => `Step ${idx + 1} result:\n${outputs.get(idx) ?? ''}`,
  );
  return parts.join('\n\n---\n\n');
}

function buildSynthesisPrompt(
  task: string,
  outputs: Map<number, string>,
): string {
  const lines = [...outputs.entries()]
    .sort(([a], [b]) => a - b)
    .map(([idx, text]) => `Step ${idx + 1}:\n${text}`);
  return `Synthesise a single coherent response for the user.

Original task: ${task}

Completed sub-task outputs:
${lines.join('\n\n---\n\n')}

Provide the final answer. Do not mention internal agent delegation.`;
}

function countToolErrors(toolCallLog: string[]): number {
  return toolCallLog.filter((line) => /"error"|error:/i.test(line)).length;
}

function parsePlanJson(text: string): TaskPlan | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const raw = JSON.parse(match[0]) as {
      singleAgent?: boolean;
      steps?: Array<{
        description: string;
        agentType: string;
        dependsOn?: number[];
      }>;
    };
    return {
      singleAgent: Boolean(raw.singleAgent),
      steps: (raw.steps ?? []).map((s) => ({
        description: s.description,
        agentType: normalizeAgentType(s.agentType),
        dependsOn: s.dependsOn ?? [],
      })),
    };
  } catch {
    return null;
  }
}

function normalizeAgentType(value: string): SubAgentType {
  const v = value.toLowerCase();
  if (v === 'coding' || v === 'communication' || v === 'file' || v === 'research') {
    return v;
  }
  return 'research';
}

function heuristicPlan(task: string): TaskPlan {
  const lower = task.toLowerCase();
  const multi =
    (lower.includes(' and ') || lower.includes(',')) &&
    (lower.includes('email') ||
      lower.includes('research') ||
      lower.includes('calculate') ||
      lower.includes('draft'));

  if (!multi) {
    return { singleAgent: true, steps: [] };
  }

  const steps: TaskPlanStep[] = [];
  let idx = 0;

  if (lower.match(/research|rate|find|look up|search/)) {
    steps.push({
      description: 'Research and gather relevant information',
      agentType: 'research',
      dependsOn: [],
    });
    idx = steps.length - 1;
  }

  if (lower.match(/calculat|compute|impact|yield|script/)) {
    steps.push({
      description: 'Perform calculations or write supporting logic',
      agentType: 'coding',
      dependsOn: steps.length > 0 ? [idx] : [],
    });
  }

  if (lower.match(/email|send|draft.*message/)) {
    steps.push({
      description: 'Draft and send the summary communication',
      agentType: 'communication',
      dependsOn: steps.length > 0 ? [steps.length - 1] : [],
    });
  }

  if (steps.length === 0) {
    return { singleAgent: true, steps: [] };
  }

  return { singleAgent: false, steps };
}
