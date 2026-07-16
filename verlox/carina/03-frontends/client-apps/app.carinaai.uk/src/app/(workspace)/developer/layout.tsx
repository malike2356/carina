import { DeveloperTabNav } from '@/components/developer/DeveloperTabNav';

export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-border px-6 pt-5 pb-0">
        <h1 className="text-base font-semibold text-text-primary">Developer</h1>
        <p className="mt-0.5 text-xs text-text-muted">Partner API keys and gateway usage.</p>
        <DeveloperTabNav />
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
