export type AivaPlaybookTemplate = {
  id: string;
  keprixPlaybookId: string;
  vertical: string;
  title: string;
  description: string;
  defaultOnHire: boolean;
  defaultVariables: Record<string, string | number | boolean>;
};

export const AIVA_PLAYBOOK_TEMPLATES: AivaPlaybookTemplate[] = [
  {
    id: 'aiva-deal-analyse',
    keprixPlaybookId: 'aiva-deal-analyse',
    vertical: 'property',
    title: 'Deal analysis pipeline',
    description: 'Analyse, score, approve, report, and send to client',
    defaultOnHire: true,
    defaultVariables: {
      min_score: 65,
      client_email: '',
    },
  },
  {
    id: 'salesgrid-outreach',
    keprixPlaybookId: 'salesgrid-outreach',
    vertical: 'sales',
    title: 'Salesgrid outreach',
    description: 'Lead discovery, outreach cadence, booking, follow-up, and owner prompts',
    defaultOnHire: true,
    defaultVariables: {
      daily_cap: 10,
      weekly_target: 50,
      booking_kind: 'discovery',
    },
  },
];

const BY_ID = new Map(AIVA_PLAYBOOK_TEMPLATES.map((item) => [item.id, item]));

export function getAivaPlaybookTemplate(id: string): AivaPlaybookTemplate | undefined {
  return BY_ID.get(id);
}

export function listAivaPlaybookTemplates(): AivaPlaybookTemplate[] {
  return [...AIVA_PLAYBOOK_TEMPLATES];
}

export function defaultPlaybookIdForRoleTemplate(templateId: string | null | undefined): string | null {
  if (!templateId) return null;
  if (templateId === 'property-manager') {
    const template = AIVA_PLAYBOOK_TEMPLATES.find((item) => item.defaultOnHire && item.vertical === 'property');
    return template?.keprixPlaybookId ?? null;
  }
  if (templateId === 'outreach-coordinator') {
    const template = AIVA_PLAYBOOK_TEMPLATES.find((item) => item.defaultOnHire && item.vertical === 'sales');
    return template?.keprixPlaybookId ?? null;
  }
  return null;
}

export function resolvePlaybookVariables(
  templateId: string,
  overrides?: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> {
  const template = getAivaPlaybookTemplate(templateId);
  if (!template) return { ...(overrides ?? {}) };
  return {
    ...template.defaultVariables,
    ...(overrides ?? {}),
  };
}
