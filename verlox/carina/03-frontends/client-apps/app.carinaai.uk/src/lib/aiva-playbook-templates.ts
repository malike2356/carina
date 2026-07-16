export type AivaPlaybookTemplateCard = {
  id: string;
  keprixPlaybookId: string;
  title: string;
  description: string;
  vertical: string;
  defaultOnHire: boolean;
};

export const AIVA_PLAYBOOK_TEMPLATE_CARDS: AivaPlaybookTemplateCard[] = [
  {
    id: 'aiva-deal-analyse',
    keprixPlaybookId: 'aiva-deal-analyse',
    title: 'Deal analysis pipeline',
    description: 'Analyse, score, approve, report, and send to client',
    vertical: 'property',
    defaultOnHire: true,
  },
];

export function playbookTemplateForRole(templateId: string | null): AivaPlaybookTemplateCard | null {
  if (templateId === 'property-manager') {
    return AIVA_PLAYBOOK_TEMPLATE_CARDS.find((item) => item.vertical === 'property') ?? null;
  }
  return null;
}
