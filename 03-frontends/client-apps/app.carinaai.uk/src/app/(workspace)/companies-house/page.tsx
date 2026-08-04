import { redirect } from 'next/navigation';

/** Canonical UI lives under Outreach tabs; More also links there. */
export default function CompaniesHouseRedirectPage() {
  redirect('/aiva/outreach/companies-house');
}
