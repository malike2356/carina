import type { Tool } from '../types/index.js';
import { isPropreneurBridgeEnabled, isPropreneurBridgeWritesEnabled } from '../workers/aiva-feature-flags.js';
import { getWorkerSessionContext } from '../workers/worker-session-context.js';
import { resolvePropreneurBinding } from '../workers/worker-bridge-store.js';
import {
  getCompliance,
  getDeals,
  getEmailActivity,
  getPortfolio,
  getProperty,
  proposeComplianceUpdate,
  proposeDeal,
  proposeFinancialLog,
} from '../bridges/propreneur-bridge.js';
import { registerSessionTool } from './session-tool-store.js';

const PROPOSAL_USER_MESSAGE =
  'Submitted for review in Propreneur. Your team must approve before anything is saved. Do not tell the user the action is complete until approved.';

function requireBinding(sessionId: string) {
  if (!isPropreneurBridgeEnabled()) {
    throw new Error('Propreneur bridge is disabled');
  }
  const ctx = getWorkerSessionContext(sessionId);
  if (!ctx) throw new Error('No active Aiva session');
  const binding = resolvePropreneurBinding(ctx.worker);
  if (!binding) throw new Error('This Aiva is not bound to a Propreneur workspace');
  return { binding, worker: ctx.worker };
}

function requireWriteBinding(sessionId: string) {
  if (!isPropreneurBridgeWritesEnabled()) {
    throw new Error('Propreneur bridge writes are disabled');
  }
  return requireBinding(sessionId);
}

export function createPropreneurPortfolioTools(sessionId: string): Tool[] {
  return [
    {
      name: 'propreneur-get-portfolio',
      description: 'List all properties in the bound Propreneur workspace with status and rent.',
      parameters: { type: 'object', properties: {} },
      execute: async () => getPortfolio(requireBinding(sessionId).binding),
    },
    {
      name: 'propreneur-get-property',
      description: 'Get detail for one Propreneur property by id.',
      parameters: {
        type: 'object',
        properties: {
          propertyId: { type: 'number', description: 'Propreneur property id' },
        },
        required: ['propertyId'],
      },
      execute: async (params) => {
        const { binding } = requireBinding(sessionId);
        const propertyId = Number(params.propertyId);
        if (!Number.isFinite(propertyId)) throw new Error('propertyId is required');
        return getProperty(binding, propertyId);
      },
    },
    {
      name: 'propreneur-get-compliance',
      description: 'Get compliance certificates and expiry dates for a Propreneur property.',
      parameters: {
        type: 'object',
        properties: {
          propertyId: { type: 'number', description: 'Propreneur property id' },
        },
        required: ['propertyId'],
      },
      execute: async (params) => {
        const propertyId = Number(params.propertyId);
        if (!Number.isFinite(propertyId)) throw new Error('propertyId is required');
        return getCompliance(requireBinding(sessionId).binding, propertyId);
      },
    },
    {
      name: 'propreneur-get-deals',
      description: 'List deal pipeline entries from Propreneur.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Optional filter: open or closed' },
        },
      },
      execute: async (params) => {
        const status = params.status ? String(params.status) : undefined;
        return getDeals(requireBinding(sessionId).binding, status);
      },
    },
    {
      name: 'propreneur-get-email-activity',
      description: 'Recent Propreneur email ingestion activity (processed inbound emails).',
      parameters: {
        type: 'object',
        properties: {
          hours: { type: 'number', description: 'Lookback hours (default 24)' },
        },
      },
      execute: async (params) => {
        const hours = params.hours != null ? Number(params.hours) : 24;
        return getEmailActivity(requireBinding(sessionId).binding, hours);
      },
    },
  ];
}

export function createPropreneurWriteTools(sessionId: string): Tool[] {
  return [
    {
      name: 'propreneur-propose-deal',
      description: 'Propose a new deal in Propreneur (pending human review; not created until approved).',
      requiresConfirmation: true,
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Deal title' },
          description: { type: 'string' },
          propertyId: { type: 'number' },
          dealValue: { type: 'number' },
          priority: { type: 'string', description: 'low, medium, or high' },
          reviewNotes: { type: 'string', description: 'Why this proposal needs review' },
        },
        required: ['title'],
      },
      execute: async (params) => {
        const { binding, worker } = requireWriteBinding(sessionId);
        const result = await proposeDeal(
          binding,
          {
            title: String(params.title),
            description: params.description ? String(params.description) : undefined,
            property_id: params.propertyId != null ? Number(params.propertyId) : undefined,
            deal_value: params.dealValue != null ? Number(params.dealValue) : undefined,
            priority: params.priority ? String(params.priority) : undefined,
            review_notes: params.reviewNotes ? String(params.reviewNotes) : undefined,
          },
          { sourceWorkerRef: worker.id },
        );
        return { ...result, message: PROPOSAL_USER_MESSAGE };
      },
    },
    {
      name: 'propreneur-propose-compliance-update',
      description: 'Propose a compliance certificate create/update in Propreneur (pending review).',
      requiresConfirmation: true,
      parameters: {
        type: 'object',
        properties: {
          propertyId: { type: 'number' },
          complianceItemId: { type: 'number', description: 'Existing item to update; omit to create' },
          type: { type: 'string', description: 'e.g. gas_safety, epc' },
          title: { type: 'string' },
          expiresAt: { type: 'string', description: 'YYYY-MM-DD' },
          status: { type: 'string' },
          reviewNotes: { type: 'string' },
        },
        required: ['propertyId'],
      },
      execute: async (params) => {
        const { binding, worker } = requireWriteBinding(sessionId);
        const propertyId = Number(params.propertyId);
        if (!Number.isFinite(propertyId)) throw new Error('propertyId is required');
        const result = await proposeComplianceUpdate(
          binding,
          {
            property_id: propertyId,
            compliance_item_id: params.complianceItemId != null ? Number(params.complianceItemId) : undefined,
            type: params.type ? String(params.type) : undefined,
            title: params.title ? String(params.title) : undefined,
            expires_at: params.expiresAt ? String(params.expiresAt) : undefined,
            status: params.status ? String(params.status) : undefined,
            review_notes: params.reviewNotes ? String(params.reviewNotes) : undefined,
          },
          { sourceWorkerRef: worker.id },
        );
        return { ...result, message: PROPOSAL_USER_MESSAGE };
      },
    },
    {
      name: 'propreneur-propose-financial-log',
      description: 'Propose logging a rent or payment in Propreneur (pending review).',
      requiresConfirmation: true,
      parameters: {
        type: 'object',
        properties: {
          propertyId: { type: 'number' },
          amount: { type: 'number', description: 'Amount in GBP' },
          paidDate: { type: 'string', description: 'YYYY-MM-DD' },
          tenancyId: { type: 'number' },
          notes: { type: 'string' },
          reviewNotes: { type: 'string' },
        },
        required: ['propertyId', 'amount'],
      },
      execute: async (params) => {
        const { binding, worker } = requireWriteBinding(sessionId);
        const propertyId = Number(params.propertyId);
        const amount = Number(params.amount);
        if (!Number.isFinite(propertyId) || !Number.isFinite(amount)) {
          throw new Error('propertyId and amount are required');
        }
        const result = await proposeFinancialLog(
          binding,
          {
            property_id: propertyId,
            amount,
            paid_date: params.paidDate ? String(params.paidDate) : undefined,
            tenancy_id: params.tenancyId != null ? Number(params.tenancyId) : undefined,
            notes: params.notes ? String(params.notes) : undefined,
            review_notes: params.reviewNotes ? String(params.reviewNotes) : undefined,
          },
          { sourceWorkerRef: worker.id },
        );
        return { ...result, message: PROPOSAL_USER_MESSAGE };
      },
    },
  ];
}

export function registerPropreneurSessionTools(sessionId: string): void {
  if (!isPropreneurBridgeEnabled()) return;
  const ctx = getWorkerSessionContext(sessionId);
  if (!ctx || !resolvePropreneurBinding(ctx.worker)) return;
  for (const tool of createPropreneurPortfolioTools(sessionId)) {
    registerSessionTool(sessionId, tool);
  }
  if (isPropreneurBridgeWritesEnabled()) {
    for (const tool of createPropreneurWriteTools(sessionId)) {
      registerSessionTool(sessionId, tool);
    }
  }
}
