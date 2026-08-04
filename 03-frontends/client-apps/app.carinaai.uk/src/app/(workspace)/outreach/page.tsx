import { redirect } from 'next/navigation';

/** Canonical Outreach UI is the sales engagement tabs under /aiva/outreach. */
export default function OutreachLegacyRedirectPage() {
  redirect('/aiva/outreach');
}
