'use client';

import { useState } from 'react';
import { CheckCircle, ChevronDown, ChevronRight, Clock, Wrench, XCircle } from 'lucide-react';
import { CopyButton } from './CopyButton';
import { AgentPlanBlock, isAgentPlan } from './AgentPlanBlock';
import type { ToolCall } from './types';

function formatJson(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

interface ToolCallBlockProps {
  toolCall: ToolCall;
  status?: 'running' | 'done' | 'error';
}

export function ToolCallBlock({ toolCall, status = toolCall.status ?? 'done' }: ToolCallBlockProps) {
  const [open, setOpen] = useState(false);
  const inputStr = formatJson(toolCall.input);
  const outputStr = formatJson(toolCall.output);

  const statusIcon = {
    running: <Clock className="h-3 w-3 animate-pulse text-text-muted" />,
    done: <CheckCircle className="h-3 w-3 text-accent" />,
    error: <XCircle className="h-3 w-3 text-danger" />,
  }[status];

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-elevated font-mono text-xs">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-overlay"
      >
        <Wrench className="h-3 w-3 shrink-0 text-text-muted" />
        {statusIcon}
        <span className="flex-1 font-medium text-text-secondary">
          {toolCall.name}
          {status === 'running' && <span className="ml-2 italic text-text-muted">running...</span>}
        </span>
        {toolCall.durationMs > 0 && (
          <span className="text-text-muted">{formatDuration(toolCall.durationMs)}</span>
        )}
        {open ? (
          <ChevronDown className="h-3 w-3 text-text-muted" />
        ) : (
          <ChevronRight className="h-3 w-3 text-text-muted" />
        )}
      </button>

      {open && (
        <div className="border-t border-border">
          <div className="px-3 pb-1 pt-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-text-muted">Input</span>
              <CopyButton text={inputStr} size="sm" />
            </div>
            <pre className="max-h-32 overflow-x-auto whitespace-pre-wrap break-words rounded bg-code-bg p-2 text-[11px] text-code-text">
              {inputStr}
            </pre>
          </div>

          {toolCall.output !== undefined && toolCall.output !== null && (
            <div className="px-3 pb-2 pt-1">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-text-muted">Output</span>
                <CopyButton text={outputStr} size="sm" />
              </div>
              {isAgentPlan(toolCall.output) ? (
                <AgentPlanBlock plan={toolCall.output} />
              ) : (
                <pre
                  className={`max-h-48 overflow-x-auto whitespace-pre-wrap break-words rounded p-2 text-[11px] ${
                    status === 'error' ? 'bg-danger-dim text-danger' : 'bg-code-bg text-code-text'
                  }`}
                >
                  {outputStr}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
