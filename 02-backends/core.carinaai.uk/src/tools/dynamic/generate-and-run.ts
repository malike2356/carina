import crypto from 'crypto';
import {
  authorizeGeneration,
  hasActiveSession,
  clearSession,
} from './auth-gate.js';
import { acquireGenerationLock, releaseGenerationLock, getGenerationLockStatus } from './concurrency-guard.js';
import { sanitizeSandboxOutput, wrapSandboxOutput } from '../../sandbox/output-sanitizer.js';
import { scanGeneratedCode } from '../../sandbox/static-scanner.js';
import { executeInSandbox } from '../../sandbox/engine.js';
import { TOOL_GENERATOR_SYSTEM_PROMPT } from './generator-prompt.js';
import { llm } from '../../brain/llm.js';
import { logSelfModEvent } from '../../security/self-mod-logger.js';
import { executeAutoResponse } from '../../security/auto-response.js';
import { trackAndCheckRapidGeneration, trackFailedGeneration, detectHighRiskPatterns } from '../../security/anomaly-detector.js';

// Temporary in-memory store for generated tools awaiting persistence.
const pendingGenerations = new Map<string, {
  code: string;
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  codeHash: string;
  generatedAt: number;
  sandboxOutput: string;
  durationMs: number;
}>();

export function getPendingGeneration(toolName: string) {
  return pendingGenerations.get(toolName) ?? null;
}

export function clearPendingGeneration(toolName: string): void {
  pendingGenerations.delete(toolName);
}

export const generateAndRunTool = {
  name: 'generate_and_run_tool',
  description: `Generate a new JavaScript tool on-the-fly when no existing tool can accomplish a task.

REQUIRES AUTHORIZATION: The operator must provide their authorization passphrase before tool generation begins.

This tool works in two phases:
  Phase 1 (requires passphrase): Generates, scans, sandbox-tests, and returns the result.
  Phase 2 (requires passphrase again via persist_runtime_tool): Persists the tool for future reuse.

The operator must re-enter the passphrase for Phase 2 to prove they reviewed the output.`,
  parameters: {
    type: 'object',
    properties: {
      task_description: {
        type: 'string',
        description: 'Describe what needs to be done. Be specific: input format, expected output.',
      },
      input_data: {
        type: 'object',
        description: 'The actual data to process. Passed as params to the generated function.',
      },
      authorization_phrase: {
        type: 'string',
        description: 'The operator authorization passphrase. Ask the operator for this before calling.',
      },
    },
    required: ['task_description', 'input_data', 'authorization_phrase'],
  },
  requiresConfirmation: true as const,
  dangerous: true as const,

  async execute(rawParams: Record<string, unknown>): Promise<unknown> {
    const args = rawParams as {
      task_description: string;
      input_data: Record<string, unknown>;
      authorization_phrase: string;
    };

    // GATE 1: Authorize generation
    const genAuth = await authorizeGeneration(args.authorization_phrase);
    args.authorization_phrase = '[REDACTED]';

    if (!genAuth.authorized) {
      if (genAuth.lockedOut) {
        return { error: `LOCKED OUT: Too many failed passphrase attempts. Lockout expires: ${genAuth.lockedUntil}. All tool generation is blocked until then.` };
      }
      if (genAuth.attemptsRemaining !== undefined && genAuth.attemptsRemaining <= 1) {
        return { error: `Incorrect passphrase. LAST ATTEMPT: next failure locks tool generation for 24 hours.` };
      }
      return { error: `Incorrect passphrase. ${genAuth.attemptsRemaining ?? 0} attempt(s) remaining.` };
    }

    const generationStartTime = Date.now();

    // Log generation request to Scout
    void logSelfModEvent('TOOL_GEN_REQUESTED', {
      task_description: args.task_description.slice(0, 200),
    });

    // Rapid generation anomaly check
    const isRapid = await trackAndCheckRapidGeneration();
    if (isRapid) {
      void executeAutoResponse('tool.rapid_generation', { reason: 'Rapid tool generation detected' });
      return { error: 'Tool generation rate limit exceeded. Too many generations in a short window. Wait 10 minutes before trying again.' };
    }

    // Concurrency guard: one generation at a time
    const requestId = crypto.randomUUID();
    const lockLabel = args.task_description.slice(0, 50);
    const lockAcquired = acquireGenerationLock(lockLabel, requestId);
    if (!lockAcquired) {
      clearSession();
      const status = getGenerationLockStatus();
      return {
        error: `Tool generation already in progress: "${status.currentLabel}" (running for ${Math.round((status.elapsedMs ?? 0) / 1000)}s). Wait for it to complete.`,
      };
    }

    try {
      // Step 1: Generate tool code via LLM
      const now = new Date();
      const llmResponse = await llm.chat(
        [
          { role: 'system', content: TOOL_GENERATOR_SYSTEM_PROMPT, timestamp: now },
          { role: 'user', content: `Task: ${args.task_description}`, timestamp: now },
        ],
      );

      // Step 2: Parse LLM response
      let generated: { name: string; description: string; parameters: Record<string, unknown>; code: string };
      try {
        generated = JSON.parse(llmResponse.content) as typeof generated;
      } catch {
        return { error: `LLM did not return valid JSON. Response was: ${llmResponse.content.slice(0, 500)}` };
      }

      if (!generated.name || !generated.code) {
        return { error: 'Generated tool missing required fields (name, code).' };
      }

      const codeHash = crypto.createHash('sha256').update(generated.code).digest('hex');
      void logSelfModEvent('TOOL_GEN_CODE_GENERATED', {
        tool_name: generated.name,
        code_length: generated.code.length,
        code_hash: codeHash,
      });

      // Step 3: Static scan
      const scanResult = scanGeneratedCode(generated.code);
      void logSelfModEvent('TOOL_GEN_STATIC_SCAN', {
        tool_name: generated.name,
        passed: scanResult.safe,
        violations: scanResult.safe ? [] : scanResult.blocked,
      });

      if (!scanResult.safe) {
        void trackFailedGeneration();
        return {
          error: `Generated code blocked by static scanner. Violations: ${scanResult.blocked.join('; ')}`,
          detail: { generated_name: generated.name, violations: scanResult.blocked },
        };
      }

      // High-risk pattern check (additional layer on top of static scanner)
      const highRiskPatterns = detectHighRiskPatterns(generated.code);
      if (highRiskPatterns.length > 0) {
        void logSelfModEvent('TOOL_HIGH_RISK_PATTERN', {
          tool_name: generated.name,
          patterns: highRiskPatterns,
          action_taken: 'Tool generation blocked.',
        });
        void executeAutoResponse('tool.high_risk_pattern', { tool_name: generated.name, patterns: highRiskPatterns });
        void trackFailedGeneration();
        return {
          error: `Generated code contains high-risk patterns: ${highRiskPatterns.join('; ')}`,
          detail: { generated_name: generated.name, patterns: highRiskPatterns },
        };
      }

      // Step 4: Execute in sandbox
      const sandboxResult = await executeInSandbox(generated.code, args.input_data);

      void logSelfModEvent(sandboxResult.success ? 'TOOL_GEN_SANDBOX_RUN' : 'TOOL_GEN_SANDBOX_FAIL', {
        tool_name: generated.name,
        duration_ms: sandboxResult.durationMs,
        error: sandboxResult.error ?? null,
        tier: sandboxResult.tier,
      });

      if (!sandboxResult.success) {
        void trackFailedGeneration();
        return {
          error: `Tool execution failed in sandbox: ${sandboxResult.error}`,
          detail: { generated_name: generated.name, duration_ms: sandboxResult.durationMs },
        };
      }

      // Step 5: Sanitize output before returning to agent context
      const sanitized = sanitizeSandboxOutput(sandboxResult.result);
      if (!sanitized.safe) {
        void logSelfModEvent('TOOL_INJECTION_BLOCKED', {
          tool_name: generated.name,
          warning: sanitized.warning,
          output_sample: JSON.stringify(sandboxResult.result).slice(0, 500),
          action_taken: 'Tool output blocked. Tool NOT saved. Operator alerted.',
        });
        void executeAutoResponse('tool.injection_blocked', {
          tool_name: generated.name,
          warning: sanitized.warning,
        });
        return {
          error: `Generated tool output blocked by security scanner. ${sanitized.warning}`,
          detail: { warning: sanitized.warning },
        };
      }

      // Store in pending generations (persist-tool retrieves this)
      pendingGenerations.set(generated.name, {
        code: generated.code,
        name: generated.name,
        description: generated.description,
        parameters: generated.parameters,
        codeHash,
        generatedAt: Date.now(),
        sandboxOutput: JSON.stringify(sandboxResult.result).slice(0, 1000),
        durationMs: sandboxResult.durationMs,
      });

      void logSelfModEvent('TOOL_GEN_COMPLETED', {
        tool_name: generated.name,
        code_hash: codeHash,
        total_duration_ms: Date.now() - generationStartTime,
        sandbox_tier: sandboxResult.tier,
      });

      return {
        success: true,
        result: wrapSandboxOutput(generated.name, sanitized.result),
        detail: {
          tool_name: generated.name,
          tool_description: generated.description,
          code_hash: codeHash,
          duration_ms: sandboxResult.durationMs,
          sandbox_tier: sandboxResult.tier,
          auth_session_active: hasActiveSession('generate'),
          auth_expires_in_seconds: 300,
          next_step: `To save this tool for permanent reuse, call persist_runtime_tool with your authorization phrase and tool_name: "${generated.name}".`,
        },
      };
    } finally {
      releaseGenerationLock();
    }
  },
};
