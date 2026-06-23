import type { AgentTrustSDK } from '@open-agent-economy/trust-sdk';
import {
  buildAttestationComment,
  LABYRINTH_SCOUT_NAMESPACE,
  LABYRINTH_SCOUT_SCHEMA,
  LABYRINTH_SCOUT_TAGS,
  type LabyrinthScoutAttestationFields,
} from './attestation-namespace.js';

export interface TrustSdkLike {
  isSchemaActive(namespace: string): Promise<boolean>;
  registerSchema(params: {
    namespace: string;
    name: string;
    description: string;
    allowedTags: string[];
    minScore: number;
    maxScore: number;
  }): Promise<string>;
  getAgentId(): Promise<bigint>;
  hasInteracted(agentA: bigint, agentB: bigint): Promise<boolean>;
  registerInteraction(params: {
    agentB: bigint;
    interactionHash: string;
    interactionType: string;
  }): Promise<{ interactionId: string; txHash?: string } | string>;
  getInteractionsBetween(agentA: bigint, agentB: bigint): Promise<string[]>;
  submitAttestation(params: {
    toAgent: bigint;
    namespace: string;
    tag: string;
    score: number;
    interactionId: string;
    comment?: string;
  }): Promise<string>;
}

export interface SubmitSecurityAttestationInput {
  toAgentWallet: string;
  fields: LabyrinthScoutAttestationFields;
  periodKey: string;
}

export interface SubmitSecurityAttestationResult {
  txHash: string;
  interactionId: string;
  namespace: string;
  tag: string;
  score: number;
  comment: string;
}

export class LabyrinthScoutAttestationAdapter {
  constructor(private readonly sdk: TrustSdkLike) {}

  static fromSdk(sdk: AgentTrustSDK): LabyrinthScoutAttestationAdapter {
    return new LabyrinthScoutAttestationAdapter(sdk);
  }

  async ensureSchema(): Promise<void> {
    const active = await this.sdk.isSchemaActive(LABYRINTH_SCOUT_NAMESPACE);
    if (active) return;

    await this.sdk.registerSchema({
      namespace: LABYRINTH_SCOUT_SCHEMA.namespace,
      name: LABYRINTH_SCOUT_SCHEMA.name,
      description: LABYRINTH_SCOUT_SCHEMA.description,
      allowedTags: [...LABYRINTH_SCOUT_SCHEMA.allowedTags],
      minScore: LABYRINTH_SCOUT_SCHEMA.minScore,
      maxScore: LABYRINTH_SCOUT_SCHEMA.maxScore,
    });
  }

  async ensureInteraction(toAgent: bigint, periodKey: string): Promise<string> {
    const fromAgent = await this.sdk.getAgentId();
    const existing = await this.sdk.getInteractionsBetween(fromAgent, toAgent);
    const existingId = existing[0];
    if (existingId) {
      return existingId;
    }

    const interacted = await this.sdk.hasInteracted(fromAgent, toAgent);
    if (interacted) {
      const ids = await this.sdk.getInteractionsBetween(fromAgent, toAgent);
      const reusedId = ids[0];
      if (reusedId) return reusedId;
    }

    const result = await this.sdk.registerInteraction({
      agentB: toAgent,
      interactionHash: `scout://security-monitoring/${periodKey}`,
      interactionType: 'security_monitoring',
    });

    if (typeof result === 'string') return result;
    return result.interactionId;
  }

  async submitSecurityAttestation(
    input: SubmitSecurityAttestationInput,
  ): Promise<SubmitSecurityAttestationResult> {
    await this.ensureSchema();

    const toAgent = walletToAgentId(input.toAgentWallet);
    const interactionId = await this.ensureInteraction(toAgent, input.periodKey);
    const comment = buildAttestationComment(input.fields);
    const tag = input.fields.runtimeHours >= 720
      ? LABYRINTH_SCOUT_TAGS.runtimeClean
      : LABYRINTH_SCOUT_TAGS.securitySummary;

    const txHash = await this.sdk.submitAttestation({
      toAgent,
      namespace: LABYRINTH_SCOUT_NAMESPACE,
      tag,
      score: input.fields.securityScore,
      interactionId,
      comment,
    });

    return {
      txHash,
      interactionId,
      namespace: LABYRINTH_SCOUT_NAMESPACE,
      tag,
      score: input.fields.securityScore,
      comment,
    };
  }
}

export function walletToAgentId(wallet: string): bigint {
  const normalized = wallet.trim().startsWith('0x') ? wallet.trim() : `0x${wallet.trim()}`;
  return BigInt(normalized);
}
