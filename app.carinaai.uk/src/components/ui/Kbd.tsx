export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center rounded border border-border px-1.5 py-0.5 font-mono text-xs text-text-secondary bg-elevated">
      {children}
    </kbd>
  );
}
