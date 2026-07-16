export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-base px-6 text-text-primary">
      <div className="max-w-md rounded-2xl border border-border bg-surface px-6 py-5 shadow-xl">
        <p className="text-xs uppercase tracking-[0.12em] text-text-muted">Carina Cloud</p>
        <h1 className="mt-2 text-xl font-semibold">You are offline.</h1>
        <p className="mt-3 text-sm text-text-secondary">
          The app can still reopen cached pages and drafts. Reconnect to continue chatting or loading fresh data.
        </p>
      </div>
    </main>
  );
}
