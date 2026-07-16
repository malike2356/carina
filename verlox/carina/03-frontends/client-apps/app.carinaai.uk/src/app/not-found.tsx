import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-base text-text-primary">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-text-secondary">This page does not exist.</p>
      <Link href="/" className="text-sm text-accent hover:underline">
        Go home
      </Link>
    </div>
  );
}
