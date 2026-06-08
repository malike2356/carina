import { llm } from '../brain/llm.js';
import { checkMonthlyBudget, recordUsage } from '../brain/cost-tracker.js';
import { config } from '../config/index.js';
import {
  getSessionHistory,
  searchMemory,
  searchRag,
  saveMemory,
  clearSession,
} from '../memory/store.js';
import { findRelevantSkills, incrementSkillUsage } from '../skills/store.js';
import { getPackSystemSuffix } from '../skills/index.js';
import { registry } from '../tools/index.js';
import type { ConfirmFn } from './tool-runner.js';
import { executeToolCall } from './tool-runner.js';
import { scanUserInput } from '../security/prompt-guard-middleware.js';
import { isSessionBlocked } from '../security/index.js';
import type { ProviderOverride } from '../brain/llm.js';
import type { AgentOptions, Message, Tool, ToolCall } from '../types/index.js';

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
  'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his',
  'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who',
  'what', 'when', 'where', 'which', 'with', 'this', 'that', 'from', 'have',
  'been', 'will', 'your', 'about', 'into', 'than', 'them', 'then', 'there',
]);

export interface TurnMeta {
  memoryTurns: number;
  ragChunks: number;
  skills: number;
}

export type TurnEvent =
  | { type: 'meta'; meta: TurnMeta }
  | { type: 'text'; content: string }
  | { type: 'tool'; content: string };

export interface TurnResult {
  text: string;
  toolsUsed: string[];
  toolCallLog: string[];
}

export class CarinaAgent {
  sessionId: string;
  private memoryReady = false;
  private confirmTool?: ConfirmFn;
  private allowedTools?: string[];
  private systemPromptSuffix = '';
  private maxTurns = 20;
  private persistMemory = true;
  private forceConfirm = false;
  private providerOverride?: ProviderOverride;
  private pendingProviderOverride?: ProviderOverride;
  private toolCallInFlight = false;

  constructor(
    sessionId: string,
    memoryReady = true,
    confirmTool?: ConfirmFn,
    options: AgentOptions = {},
  ) {
    this.sessionId = sessionId;
    this.memoryReady = memoryReady && (options.persistMemory !== false);
    this.confirmTool = options.confirmTool ?? confirmTool;
    this.allowedTools = options.allowedTools;
    this.systemPromptSuffix = options.systemPromptSuffix ?? '';
    this.maxTurns = options.maxTurns ?? 20;
    this.persistMemory = options.persistMemory !== false;
    this.forceConfirm = options.forceConfirm ?? false;
    this.providerOverride = options.providerOverride;
  }

  setProviderOverride(override: ProviderOverride): void {
    if (this.toolCallInFlight) {
      this.pendingProviderOverride = override;
      return;
    }
    this.providerOverride = override;
  }

  getProviderOverride(): ProviderOverride | undefined {
    return this.pendingProviderOverride ?? this.providerOverride;
  }

  getTools(): Tool[] {
    const all = registry.list();
    if (!this.allowedTools) return all;
    return all.filter((t) => this.allowedTools!.includes(t.name));
  }

  async buildContext(userMessage: string): Promise<{ messages: Message[]; meta: TurnMeta }> {
    const meta: TurnMeta = { memoryTurns: 0, ragChunks: 0, skills: 0 };
    const contextParts: string[] = [];

    const packSuffix = getPackSystemSuffix(config.carina.activePack);
    if (packSuffix) contextParts.push(packSuffix);
    if (this.systemPromptSuffix) {
      contextParts.push(this.systemPromptSuffix);
    }

    if (this.memoryReady) {
      const history = await getSessionHistory(
        this.sessionId,
        config.carina.maxMemoryContext,
      );
      if (history.length > 0) {
        meta.memoryTurns = history.length;
        const lines = history.map((m) => `${m.role}: ${m.content}`);
        contextParts.push(`Recent session history:\n${lines.join('\n')}`);
      }

      const similar = await searchMemory(userMessage, 5);
      const otherSession = similar.filter((m) => m.sessionId !== this.sessionId);
      if (otherSession.length > 0) {
        meta.memoryTurns += otherSession.length;
        const lines = otherSession.map((m) => `[${m.sessionId}] ${m.role}: ${m.content}`);
        contextParts.push(`Relevant past memories:\n${lines.join('\n')}`);
      }

      const rag = await searchRag(userMessage, 3);
      if (rag.length > 0) {
        meta.ragChunks = rag.length;
        const lines = rag.map((c) => `[${c.source}] ${c.content}`);
        contextParts.push(`Property knowledge (RAG):\n${lines.join('\n\n')}`);
      }

      const keywords = extractKeywords(userMessage);
      const skills = await findRelevantSkills(keywords);
      if (skills.length > 0) {
        meta.skills = skills.length;
        for (const skill of skills) {
          await incrementSkillUsage(skill.id);
        }
        const lines = skills.map(
          (s) => `Skill: ${s.name}\n${s.description}\nSteps:\n${s.steps}`,
        );
        contextParts.push(`Relevant skills:\n${lines.join('\n\n')}`);
      }
    }

    const messages: Message[] = [];
    if (contextParts.length > 0) {
      messages.push({
        role: 'system',
        content: contextParts.join('\n\n---\n\n'),
        timestamp: new Date(),
      });
    }

    messages.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    });

    return { messages, meta };
  }

  async *turn(userMessage: string, priorContext?: string): AsyncGenerator<TurnEvent> {
    if (process.env.LABYRINTH_ENABLED === 'true' && isSessionBlocked(this.sessionId)) {
      yield {
        type: 'text' as const,
        content: '[Session blocked by security policy. Start a new session to continue.]',
      };
      return;
    }

    const safeUserMessage = await scanUserInput(userMessage);
    const prompt = priorContext
      ? `${priorContext}\n\n---\n\nTask:\n${safeUserMessage}`
      : safeUserMessage;
    const { messages: initial, meta } = await this.buildContext(prompt);
    const messages = [...initial];
    yield { type: 'meta', meta };

    const tools = this.getTools();
    let turnText = '';
    const toolsUsed: string[] = [];
    const toolCallLog: string[] = [];
    let turns = 0;
    let budgetWarned = false;

    while (turns < this.maxTurns) {
      turns++;
      if (this.pendingProviderOverride) {
        this.providerOverride = this.pendingProviderOverride;
        this.pendingProviderOverride = undefined;
      }

      const budget = await checkMonthlyBudget();
      if (budget.status === 'blocked') {
        yield { type: 'text', content: `[${budget.message}]` };
        break;
      }
      if (budget.status === 'warn' && !budgetWarned) {
        budgetWarned = true;
        yield { type: 'text', content: `[${budget.message}]\n\n` };
      }

      const response = await llm.chatRouted(messages, tools, undefined, this.providerOverride);
      await recordUsage(this.sessionId, response.provider, response.tokensUsed, llm.modelFor(response.provider));

      const textBuffer = response.content;
      const toolCalls: ToolCall[] = response.toolCalls ?? [];
      if (textBuffer) {
        turnText += textBuffer;
        yield { type: 'text', content: textBuffer };
      }

      if (toolCalls.length === 0) {
        if (this.memoryReady && this.persistMemory) {
          await saveMemory(this.sessionId, 'user', safeUserMessage);
          await saveMemory(this.sessionId, 'assistant', turnText);
        }
        break;
      }

      messages.push({
        role: 'assistant',
        content: textBuffer,
        toolCalls,
        timestamp: new Date(),
      });

      for (const call of toolCalls) {
        toolsUsed.push(call.toolName);
        toolCallLog.push(`${call.toolName}: ${JSON.stringify(call.params).slice(0, 120)}`);
        const status = `\n[using ${call.toolName}...]\n`;
        yield { type: 'tool', content: status };

        this.toolCallInFlight = true;
        try {
          const result = await executeToolCall(
            call,
            this.confirmTool,
            this.forceConfirm,
            this.sessionId,
          );
          messages.push({
            role: 'tool_result',
            content: '',
            toolCallId: call.toolCallId,
            toolName: call.toolName,
            result,
            timestamp: new Date(),
          });
        } finally {
          this.toolCallInFlight = false;
        }
      }
    }

    (this as CarinaAgent & { lastTurn?: TurnResult }).lastTurn = {
      text: turnText,
      toolsUsed,
      toolCallLog,
    };
  }

  getLastTurn(): TurnResult {
    const agent = this as CarinaAgent & { lastTurn?: TurnResult };
    return agent.lastTurn ?? { text: '', toolsUsed: [], toolCallLog: [] };
  }

  async runTurn(userMessage: string, priorContext?: string): Promise<TurnResult> {
    for await (const _ of this.turn(userMessage, priorContext)) {
      // consume stream
    }
    return this.getLastTurn();
  }

  async recall(limit: number): Promise<Message[]> {
    const memories = await getSessionHistory(this.sessionId, limit);
    return memories.map((m) => ({
      role: m.role ?? 'user',
      content: m.content,
      timestamp: m.createdAt,
    }));
  }

  async clear(): Promise<void> {
    if (this.memoryReady) {
      await clearSession(this.sessionId);
    }
  }
}

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w))
    .slice(0, 10);
}
