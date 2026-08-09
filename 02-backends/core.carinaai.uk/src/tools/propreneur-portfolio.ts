import type { Tool } from '../types/index.js';
import { isPropreneurBridgeEnabled, isPropreneurBridgeWritesEnabled } from '../workers/aiva-feature-flags.js';
import { getWorkerSessionContext } from '../workers/worker-session-context.js';
import { resolvePropreneurBinding } from '../workers/worker-bridge-store.js';
import {
  getCompliance,
  getContacts,
  getContact,
  getContactInteractions,
  getDeals,
  getDocuments,
  getEmailActivity,
  getExpenses,
  getIncome,
  getMaintenanceRequests,
  getMaintenanceRequest,
  getOnboardingStatus,
  getPortfolio,
  getProperty,
  getRentPayments,
  getRoles,
  getSourcingLeads,
  getTeamMembers,
  getWorksOrders,
  getWorkspaceSettings,
  proposeComplianceUpdate,
  proposeContact,
  proposeDeal,
  proposeExpense,
  proposeFinancialLog,
  proposeMaintenance,
  proposeSetting,
  proposeTeamInvite,
  proposeWorksOrder,
  proxyDispatch,
  generateSessionUrl,
  chatWithCarina,
} from '../bridges/propreneur-bridge.js';
import { registerSessionTool } from './session-tool-store.js';
import {
  filterToolsByContract,
  loadPropreneurToolsContract,
} from './propreneur-tools-registry.js';
import {
  getPropreneurSessionTenantState,
  requirePropreneurSessionTenant,
} from './propreneur-session-tenant.js';

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
  // Enforce session tenant selection only when multi-tenant linking was bound for this session.
  const tenantState = getPropreneurSessionTenantState(sessionId);
  if (tenantState.linkedUserId || tenantState.tenants.length > 0) {
    const tenantGate = requirePropreneurSessionTenant(sessionId);
    if (!tenantGate.ok) {
      throw new Error(tenantGate.message);
    }
  }
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

export function createPropreneurExpandedReadTools(sessionId: string): Tool[] {
  return [
    {
      name: 'propreneur-get-contacts',
      description: 'List CRM contacts from Propreneur. Optional type filter (tenant, contractor, investor, agent).',
      parameters: {
        type: 'object',
        properties: { type: { type: 'string', description: 'Filter by type' } },
      },
      execute: async (params) => {
        const t = params.type ? String(params.type) : undefined;
        return getContacts(requireBinding(sessionId).binding, t);
      },
    },
    {
      name: 'propreneur-get-contact',
      description: 'Get detail for one CRM contact by id.',
      parameters: {
        type: 'object',
        properties: { contactId: { type: 'number' } },
        required: ['contactId'],
      },
      execute: async (params) => getContact(requireBinding(sessionId).binding, Number(params.contactId)),
    },
    {
      name: 'propreneur-get-contact-interactions',
      description: 'List recent interactions (calls, emails, meetings) for a CRM contact.',
      parameters: {
        type: 'object',
        properties: { contactId: { type: 'number' } },
        required: ['contactId'],
      },
      execute: async (params) => getContactInteractions(requireBinding(sessionId).binding, Number(params.contactId)),
    },
    {
      name: 'propreneur-get-sourcing-leads',
      description:
        'List property sourcing leads. Optional stage filter: ' +
        'identified, viewing_booked, viewed, under_analysis, offer_made, offer_accepted, conveyancing, completed, rejected, archived.',
      parameters: {
        type: 'object',
        properties: { stage: { type: 'string', description: 'Pipeline stage filter' } },
      },
      execute: async (params) => {
        const s = params.stage ? String(params.stage) : undefined;
        return getSourcingLeads(requireBinding(sessionId).binding, s);
      },
    },
    {
      name: 'propreneur-get-maintenance-requests',
      description: 'List maintenance/repair requests. Filter by status (open, in_progress, resolved) or property_id.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          propertyId: { type: 'number' },
        },
      },
      execute: async (params) => {
        const filters: Record<string, string> = {};
        if (params.status) filters.status = String(params.status);
        if (params.propertyId != null) filters.property_id = String(params.propertyId);
        return getMaintenanceRequests(requireBinding(sessionId).binding, filters);
      },
    },
    {
      name: 'propreneur-get-maintenance-request',
      description: 'Get detail for a single maintenance request by id.',
      parameters: {
        type: 'object',
        properties: { requestId: { type: 'number' } },
        required: ['requestId'],
      },
      execute: async (params) => getMaintenanceRequest(requireBinding(sessionId).binding, Number(params.requestId)),
    },
    {
      name: 'propreneur-get-works-orders',
      description: 'List works orders (contractor jobs). Filter by status or property_id.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          propertyId: { type: 'number' },
        },
      },
      execute: async (params) => {
        const filters: Record<string, string> = {};
        if (params.status) filters.status = String(params.status);
        if (params.propertyId != null) filters.property_id = String(params.propertyId);
        return getWorksOrders(requireBinding(sessionId).binding, filters);
      },
    },
    {
      name: 'propreneur-get-expenses',
      description: 'List expenses from Propreneur. Filter by property_id or date range (since: YYYY-MM-DD).',
      parameters: {
        type: 'object',
        properties: {
          propertyId: { type: 'number' },
          since: { type: 'string', description: 'YYYY-MM-DD start date' },
        },
      },
      execute: async (params) => {
        const filters: Record<string, string> = {};
        if (params.propertyId != null) filters.property_id = String(params.propertyId);
        if (params.since) filters.since = String(params.since);
        return getExpenses(requireBinding(sessionId).binding, filters);
      },
    },
    {
      name: 'propreneur-get-income',
      description: 'List active income streams from Propreneur (rent, commercial leases, etc.).',
      parameters: { type: 'object', properties: {} },
      execute: async () => getIncome(requireBinding(sessionId).binding),
    },
    {
      name: 'propreneur-get-rent-payments',
      description: 'List tenant rent payments. Optional since filter (YYYY-MM-DD).',
      parameters: {
        type: 'object',
        properties: { since: { type: 'string', description: 'YYYY-MM-DD start date' } },
      },
      execute: async (params) => {
        const filters = params.since ? { since: String(params.since) } : undefined;
        return getRentPayments(requireBinding(sessionId).binding, filters);
      },
    },
    {
      name: 'propreneur-get-documents',
      description: 'List documents stored in Propreneur. Filter by property_id or category.',
      parameters: {
        type: 'object',
        properties: {
          propertyId: { type: 'number' },
          category: { type: 'string' },
        },
      },
      execute: async (params) => {
        const filters: Record<string, string> = {};
        if (params.propertyId != null) filters.property_id = String(params.propertyId);
        if (params.category) filters.category = String(params.category);
        return getDocuments(requireBinding(sessionId).binding, filters);
      },
    },
    {
      name: 'propreneur-get-workspace-settings',
      description: 'Read non-sensitive workspace settings from Propreneur.',
      parameters: { type: 'object', properties: {} },
      execute: async () => getWorkspaceSettings(requireBinding(sessionId).binding),
    },
    {
      name: 'propreneur-get-onboarding-status',
      description: 'Get workspace onboarding progress (completed, current stage, deferred status).',
      parameters: { type: 'object', properties: {} },
      execute: async () => getOnboardingStatus(requireBinding(sessionId).binding),
    },
    {
      name: 'propreneur-get-team',
      description: 'List all team members in the Propreneur workspace with roles and status.',
      parameters: { type: 'object', properties: {} },
      execute: async () => getTeamMembers(requireBinding(sessionId).binding),
    },
    {
      name: 'propreneur-get-roles',
      description: 'List available roles and their permissions in the Propreneur workspace.',
      parameters: { type: 'object', properties: {} },
      execute: async () => getRoles(requireBinding(sessionId).binding),
    },
  ];
}

export function createPropreneurExpandedWriteTools(sessionId: string): Tool[] {
  return [
    {
      name: 'propreneur-propose-contact',
      description: 'Propose creating or updating a CRM contact in Propreneur (pending review).',
      requiresConfirmation: true,
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', description: 'create or update' },
          contactId: { type: 'number', description: 'For updates: existing contact id' },
          name: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string' },
          company: { type: 'string' },
          type: { type: 'string', description: 'tenant, contractor, investor, agent' },
          role: { type: 'string' },
          notes: { type: 'string' },
          reviewNotes: { type: 'string' },
        },
        required: ['action'],
      },
      execute: async (params) => {
        const { binding, worker } = requireWriteBinding(sessionId);
        const result = await proposeContact(binding, {
          action: String(params.action),
          contact_id: params.contactId != null ? Number(params.contactId) : undefined,
          name: params.name ? String(params.name) : undefined,
          email: params.email ? String(params.email) : undefined,
          phone: params.phone ? String(params.phone) : undefined,
          company: params.company ? String(params.company) : undefined,
          type: params.type ? String(params.type) : undefined,
          role: params.role ? String(params.role) : undefined,
          notes: params.notes ? String(params.notes) : undefined,
          review_notes: params.reviewNotes ? String(params.reviewNotes) : undefined,
        }, { sourceWorkerRef: worker.id });
        return { ...result, message: PROPOSAL_USER_MESSAGE };
      },
    },
    {
      name: 'propreneur-propose-maintenance',
      description: 'Propose a maintenance request in Propreneur (pending review).',
      requiresConfirmation: true,
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', description: 'create or update' },
          propertyId: { type: 'number' },
          title: { type: 'string' },
          category: { type: 'string' },
          description: { type: 'string' },
          priority: { type: 'string', description: 'low, medium, high, urgent' },
          reviewNotes: { type: 'string' },
        },
        required: ['action', 'propertyId', 'title'],
      },
      execute: async (params) => {
        const { binding, worker } = requireWriteBinding(sessionId);
        const result = await proposeMaintenance(binding, {
          action: String(params.action),
          property_id: Number(params.propertyId),
          title: String(params.title),
          category: params.category ? String(params.category) : undefined,
          description: params.description ? String(params.description) : undefined,
          priority: params.priority ? String(params.priority) : undefined,
          review_notes: params.reviewNotes ? String(params.reviewNotes) : undefined,
        }, { sourceWorkerRef: worker.id });
        return { ...result, message: PROPOSAL_USER_MESSAGE };
      },
    },
    {
      name: 'propreneur-propose-works-order',
      description: 'Propose a works order (contractor job) in Propreneur (pending review).',
      requiresConfirmation: true,
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', description: 'create or update' },
          propertyId: { type: 'number' },
          title: { type: 'string' },
          trade: { type: 'string', description: 'e.g. plumbing, electrical, general' },
          description: { type: 'string' },
          contractorContactId: { type: 'number' },
          budgetAmount: { type: 'number' },
          scheduledAt: { type: 'string', description: 'YYYY-MM-DD' },
          reviewNotes: { type: 'string' },
        },
        required: ['action', 'propertyId', 'title'],
      },
      execute: async (params) => {
        const { binding, worker } = requireWriteBinding(sessionId);
        const result = await proposeWorksOrder(binding, {
          action: String(params.action),
          property_id: Number(params.propertyId),
          title: String(params.title),
          trade: params.trade ? String(params.trade) : undefined,
          description: params.description ? String(params.description) : undefined,
          contractor_contact_id: params.contractorContactId != null ? Number(params.contractorContactId) : undefined,
          budget_amount: params.budgetAmount != null ? Number(params.budgetAmount) : undefined,
          scheduled_at: params.scheduledAt ? String(params.scheduledAt) : undefined,
          review_notes: params.reviewNotes ? String(params.reviewNotes) : undefined,
        }, { sourceWorkerRef: worker.id });
        return { ...result, message: PROPOSAL_USER_MESSAGE };
      },
    },
    {
      name: 'propreneur-propose-expense',
      description: 'Propose logging an expense in Propreneur (pending review).',
      requiresConfirmation: true,
      parameters: {
        type: 'object',
        properties: {
          propertyId: { type: 'number' },
          vendorName: { type: 'string' },
          description: { type: 'string' },
          category: { type: 'string' },
          amount: { type: 'number', description: 'Amount in GBP' },
          expenseDate: { type: 'string', description: 'YYYY-MM-DD' },
          paymentMethod: { type: 'string' },
          taxDeductible: { type: 'boolean' },
          reviewNotes: { type: 'string' },
        },
        required: ['vendorName', 'description', 'amount', 'expenseDate'],
      },
      execute: async (params) => {
        const { binding, worker } = requireWriteBinding(sessionId);
        const result = await proposeExpense(binding, {
          property_id: params.propertyId != null ? Number(params.propertyId) : undefined,
          vendor_name: String(params.vendorName),
          description: String(params.description),
          category: params.category ? String(params.category) : undefined,
          amount: Number(params.amount),
          expense_date: String(params.expenseDate),
          payment_method: params.paymentMethod ? String(params.paymentMethod) : undefined,
          tax_deductible: params.taxDeductible != null ? Boolean(params.taxDeductible) : undefined,
          review_notes: params.reviewNotes ? String(params.reviewNotes) : undefined,
        }, { sourceWorkerRef: worker.id });
        return { ...result, message: PROPOSAL_USER_MESSAGE };
      },
    },
    {
      name: 'propreneur-propose-team-invite',
      description: 'Propose inviting a team member, updating their role, or deactivating them (pending review).',
      requiresConfirmation: true,
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', description: 'invite, update_role, or deactivate' },
          userId: { type: 'number', description: 'For update/deactivate: existing user id' },
          name: { type: 'string' },
          email: { type: 'string' },
          role: { type: 'string' },
          reviewNotes: { type: 'string' },
        },
        required: ['action'],
      },
      execute: async (params) => {
        const { binding, worker } = requireWriteBinding(sessionId);
        const result = await proposeTeamInvite(binding, {
          action: String(params.action),
          user_id: params.userId != null ? Number(params.userId) : undefined,
          name: params.name ? String(params.name) : undefined,
          email: params.email ? String(params.email) : undefined,
          role: params.role ? String(params.role) : undefined,
          review_notes: params.reviewNotes ? String(params.reviewNotes) : undefined,
        }, { sourceWorkerRef: worker.id });
        return { ...result, message: PROPOSAL_USER_MESSAGE };
      },
    },
    {
      name: 'propreneur-propose-setting',
      description: 'Propose changing a workspace setting in Propreneur (pending review).',
      requiresConfirmation: true,
      parameters: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'Setting key' },
          value: { type: 'string', description: 'New value' },
          group: { type: 'string' },
          reviewNotes: { type: 'string' },
        },
        required: ['key', 'value'],
      },
      execute: async (params) => {
        const { binding, worker } = requireWriteBinding(sessionId);
        const result = await proposeSetting(binding, {
          key: String(params.key),
          value: String(params.value),
          group: params.group ? String(params.group) : undefined,
          review_notes: params.reviewNotes ? String(params.reviewNotes) : undefined,
        }, { sourceWorkerRef: worker.id });
        return { ...result, message: PROPOSAL_USER_MESSAGE };
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

export function createPropreneurCarinaRelayTool(sessionId: string): Tool[] {
  return [
    {
      name: 'propreneur-carina-chat',
      description:
        'Send a message to the Carina AI agent running inside the connected Propreneur workspace. ' +
        'Use this when the user wants to run complex multi-step property tasks, get AI-generated ' +
        'reports, or ask questions that require deep access to their tenancy, compliance, CRM, or ' +
        'financial data. The Propreneur Carina has full workspace context and specialist property ' +
        'knowledge. Do not use this for simple data lookups - use the specific propreneur-get-* ' +
        'tools for those.',
      parameters: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'The message or task to send to Propreneur Carina.',
          },
        },
        required: ['message'],
      },
      execute: async (params) => {
        const { binding } = requireBinding(sessionId);
        const message = String(params.message ?? '').trim();
        if (!message) throw new Error('message is required');
        const result = await chatWithCarina(binding, message, `carina_standalone_${sessionId}`);
        if (result.requires_confirmation) {
          return {
            reply: result.reply,
            note: 'Propreneur Carina needs human approval before completing this action. The user must log in to Propreneur.',
            requires_confirmation: true,
          };
        }
        return { reply: result.reply, steps_used: result.steps_used };
      },
    },
  ];
}

export function createPropreneurProxyTool(sessionId: string): Tool[] {
  return [
    {
      name: 'propreneur-proxy',
      description:
        'Call any internal Propreneur API route via the scoped proxy. Use this for routes ' +
        'not covered by the specific propreneur-get-* and propreneur-propose-* tools. ' +
        'The proxy respects scope restrictions on the bound token. Blocked routes (auth, ' +
        'billing mutations, admin) will return 403.',
      parameters: {
        type: 'object',
        properties: {
          targetPath: {
            type: 'string',
            description: 'Internal route path, e.g. "api/contacts" or "api/properties/5/tenancies"',
          },
          targetMethod: {
            type: 'string',
            description: 'HTTP method: GET, POST, PUT, PATCH, DELETE. Default: GET',
          },
          targetBody: {
            type: 'object',
            description: 'Request body for POST/PUT/PATCH',
          },
          targetQuery: {
            type: 'object',
            description: 'Query parameters as key-value pairs',
          },
        },
        required: ['targetPath'],
      },
      execute: async (params) => {
        const { binding } = requireBinding(sessionId);
        const targetPath = String(params.targetPath ?? '').trim();
        if (!targetPath) throw new Error('targetPath is required');
        return proxyDispatch(binding, {
          targetPath,
          targetMethod: params.targetMethod ? String(params.targetMethod) : 'GET',
          targetBody: (params.targetBody as Record<string, unknown>) ?? {},
          targetQuery: (params.targetQuery as Record<string, string>) ?? {},
        });
      },
    },
  ];
}

export function createPropreneurSessionLinkTool(sessionId: string): Tool[] {
  return [
    {
      name: 'propreneur-open-workspace',
      description:
        'Generate a short-lived signed URL that logs the user into their Propreneur workspace. ' +
        'Returns a clickable link valid for 5 minutes. Use this when the user wants to view ' +
        'or manage something in the full Propreneur UI. You can deep-link to a specific page ' +
        'like /properties/5 or /contacts/12. Present the link as a clickable action to the user.',
      parameters: {
        type: 'object',
        properties: {
          redirectTo: {
            type: 'string',
            description:
              'Deep-link path within Propreneur, e.g. "/dashboard", "/properties/5", ' +
              '"/contacts/12", "/maintenance", "/deals". Omit for the dashboard.',
          },
        },
      },
      execute: async (params) => {
        const { binding } = requireBinding(sessionId);
        const redirectTo = params.redirectTo ? String(params.redirectTo) : undefined;
        return generateSessionUrl(binding, { redirectTo });
      },
    },
  ];
}

export function registerPropreneurSessionTools(sessionId: string): void {
  if (!isPropreneurBridgeEnabled()) return;
  const ctx = getWorkerSessionContext(sessionId);
  if (!ctx || !resolvePropreneurBinding(ctx.worker)) return;

  // Reject incompatible contract versions early so tools are never half-registered.
  loadPropreneurToolsContract();

  const tools = [
    ...createPropreneurPortfolioTools(sessionId),
    ...createPropreneurExpandedReadTools(sessionId),
    ...(isPropreneurBridgeWritesEnabled()
      ? [
          ...createPropreneurWriteTools(sessionId),
          ...createPropreneurExpandedWriteTools(sessionId),
        ]
      : []),
    ...createPropreneurCarinaRelayTool(sessionId),
    ...createPropreneurProxyTool(sessionId),
    ...createPropreneurSessionLinkTool(sessionId),
  ];

  for (const tool of filterToolsByContract(tools, { allowUnlisted: true })) {
    registerSessionTool(sessionId, tool);
  }
}
