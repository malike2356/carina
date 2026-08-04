import { redirect } from 'next/navigation';
import { OPS_BUSINESS_SHELL_PREFIX } from '@/lib/admin-base-path';

const OPS_LOGIN_URL = (process.env.OPS_CONSOLE_URL ?? 'https://ops.carinaai.uk').replace(/\/$/, '');

export default function AdminLoginRedirectPage() {
  redirect(`${OPS_LOGIN_URL}/login?callbackUrl=${OPS_BUSINESS_SHELL_PREFIX}/customers`);
}
