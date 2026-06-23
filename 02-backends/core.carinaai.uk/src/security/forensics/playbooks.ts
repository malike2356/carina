import type { IRPlaybook } from './types.js';

export const FORENSIC_PLAYBOOKS: IRPlaybook[] = [
  {
    id: 'prompt-injection',
    name: 'Prompt Injection Attack',
    trigger: {
      eventTypes: ['prompt_guard_alert', 'prompt_injection', 'injection_blocked', 'injection_detected'],
      severity: 'critical',
      autoExecute: true,
    },
    steps: [
      { order: 1, action: 'contain', description: 'Block the injected prompt from reaching the model', automated: true },
      { order: 2, action: 'investigate', description: 'Capture forensic snapshot', automated: true },
      { order: 3, action: 'notify', description: 'Alert security team', automated: true },
      { order: 4, action: 'recover', description: 'Review and unblock if false positive', automated: false },
      { order: 5, action: 'report', description: 'Generate incident report', automated: true },
    ],
  },
  {
    id: 'data-exfiltration',
    name: 'Suspected Data Exfiltration',
    trigger: {
      eventTypes: ['egress_filter_alert', 'unusual_tool_sequence', 'tool_sequence_guard'],
      severity: 'critical',
      autoExecute: true,
    },
    steps: [
      { order: 1, action: 'contain', description: 'Block outbound network traffic for the session', automated: true },
      { order: 2, action: 'investigate', description: 'Capture full forensic snapshot and network logs', automated: true },
      { order: 3, action: 'notify', description: 'Alert security team with full context', automated: true },
      { order: 4, action: 'recover', description: 'Human review of exfiltrated data scope', automated: false },
    ],
  },
  {
    id: 'credential-theft',
    name: 'Credential Theft Attempt',
    trigger: {
      eventTypes: ['credential_leak', 'secrets_exposure', 'honeypot_alert'],
      severity: 'critical',
      autoExecute: true,
    },
    steps: [
      { order: 1, action: 'contain', description: 'Redact outputs and block further secret reads', automated: true },
      { order: 2, action: 'investigate', description: 'Capture forensic snapshot and secret access logs', automated: true },
      { order: 3, action: 'notify', description: 'Alert security team and credential owners', automated: true },
      { order: 4, action: 'report', description: 'Generate credential exposure report', automated: true },
    ],
  },
  {
    id: 'privilege-escalation',
    name: 'Privilege Escalation Attempt',
    trigger: {
      eventTypes: ['tool_rbac_denied', 'admin_tool_blocked'],
      severity: 'warning',
      autoExecute: false,
    },
    steps: [
      { order: 1, action: 'contain', description: 'Deny elevated tool execution', automated: true },
      { order: 2, action: 'investigate', description: 'Capture session timeline and RBAC audit trail', automated: true },
      { order: 3, action: 'notify', description: 'Notify security team if repeated attempts observed', automated: true },
    ],
  },
  {
    id: 'kill-switch',
    name: 'Kill Switch Containment',
    trigger: {
      eventTypes: ['kill_switch', 'ransomware_pattern', 'scout_suspend'],
      severity: 'critical',
      autoExecute: true,
    },
    steps: [
      { order: 1, action: 'contain', description: 'Suspend agent and block affected session', automated: true },
      { order: 2, action: 'investigate', description: 'Capture forensic snapshot and system state', automated: true },
      { order: 3, action: 'notify', description: 'Alert security team immediately', automated: true },
      { order: 4, action: 'recover', description: 'Restore from clean state after human review', automated: false },
    ],
  },
  {
    id: 'supply-chain',
    name: 'Supply Chain Anomaly',
    trigger: {
      eventTypes: ['dependency_alert', 'sbom_violation'],
      severity: 'warning',
      autoExecute: false,
    },
    steps: [
      { order: 1, action: 'investigate', description: 'Collect dependency and provenance evidence', automated: true },
      { order: 2, action: 'notify', description: 'Notify platform operators', automated: true },
      { order: 3, action: 'report', description: 'Generate supply chain incident report', automated: true },
    ],
  },
];

export function getPlaybook(playbookId: string): IRPlaybook | undefined {
  return FORENSIC_PLAYBOOKS.find((row) => row.id === playbookId);
}

export function findPlaybookForEvent(eventType: string): IRPlaybook | undefined {
  return FORENSIC_PLAYBOOKS.find((row) => row.trigger.eventTypes.includes(eventType));
}
