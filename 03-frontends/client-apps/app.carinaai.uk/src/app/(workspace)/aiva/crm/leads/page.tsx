import { redirect } from 'next/navigation';

/** Alias so owners can bookmark /aiva/crm/leads as the CRM table. */
export default function CrmLeadsAliasPage() {
  redirect('/aiva/outreach/leads');
}
