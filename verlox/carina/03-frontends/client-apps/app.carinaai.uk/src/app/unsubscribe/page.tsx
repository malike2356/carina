import { redirect } from 'next/navigation';

/** Friendly path; emails use /api/auth/unsubscribe (same handler). */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token?.trim() ?? '';
  const q = token ? `?token=${encodeURIComponent(token)}` : '';
  redirect(`/api/auth/unsubscribe${q}`);
}
