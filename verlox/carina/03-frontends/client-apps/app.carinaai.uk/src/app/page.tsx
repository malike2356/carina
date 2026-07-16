import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getBrandForCurrentRequest } from '@/lib/server-brand';

export default async function HomePage() {
  const session = await getSession();
  if (session) redirect('/launcher');

  const brand = await getBrandForCurrentRequest();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-6">
      <h1 className="text-4xl font-semibold tracking-tight">{brand.publicSiteTitle}</h1>
      <p className="text-lg text-text-secondary">
        Use {brand.productName} in your browser. Bring your own LLM keys, optional skill packs, no install required.
      </p>
      <div className="flex gap-3">
        <Link href="/register" className="rounded-md bg-accent px-4 py-2 text-primary-foreground font-medium hover:bg-accent-hover">
          Create account
        </Link>
        <Link href="/login" className="rounded-md border border-border px-4 py-2 hover:bg-elevated">
          Sign in
        </Link>
      </div>
    </main>
  );
}
