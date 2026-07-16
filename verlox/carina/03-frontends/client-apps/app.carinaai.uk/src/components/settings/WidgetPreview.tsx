'use client';

interface WidgetPreviewProps {
  logoUrl: string | null;
  companyName: string | null;
  primaryColor: string;
  hideVerloxAttribution: boolean;
  workerName?: string;
}

export function WidgetPreview({
  logoUrl,
  companyName,
  primaryColor,
  hideVerloxAttribution,
  workerName = 'Aria',
}: WidgetPreviewProps) {
  const headerLabel = workerName;
  const subLabel = companyName?.trim() || null;
  const accent = primaryColor || '#1a5f7a';

  return (
    <div className="rounded-xl border border-border bg-base p-4">
      <p className="mb-3 text-xs font-medium text-text-muted">Widget preview</p>
      <div
        className="origin-top-left scale-[0.7]"
        style={{ width: '360px' }}
      >
        <div className="overflow-hidden rounded-2xl border border-border shadow-lg">
          <div className="flex items-center gap-2 px-3 py-2.5" style={{ backgroundColor: accent }}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/20">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="h-full w-full object-contain p-0.5" />
              ) : (
                <span className="text-xs font-semibold text-white">{headerLabel.charAt(0)}</span>
              )}
            </div>
            <div className="min-w-0">
              <span className="block truncate text-sm font-medium text-white">{headerLabel}</span>
              {subLabel ? (
                <span className="block truncate text-[11px] text-white/75">{subLabel}</span>
              ) : null}
            </div>
          </div>
          <div className="space-y-2 bg-elevated p-3">
            <div className="mr-8 rounded-lg bg-overlay px-2.5 py-2 text-[11px] text-text-secondary">
              Hi, how can I help you today?
            </div>
            <div
              className="ml-8 rounded-lg px-2.5 py-2 text-right text-[11px] text-white"
              style={{ backgroundColor: accent }}
            >
              I have a question about my order.
            </div>
          </div>
          <div className="border-t border-border bg-base px-3 py-2">
            <div className="rounded-full border border-border px-3 py-1.5 text-[10px] text-text-muted">
              Type a message...
            </div>
          </div>
          {!hideVerloxAttribution ? (
            <div className="border-t border-border bg-base px-3 py-1.5 text-center text-[9px] text-text-muted">
              Powered by VERLOX
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
