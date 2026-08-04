import { CarinaWidget } from './widget';

declare global {
  interface Window {
    CARINA_AIVA_ID?: string;
    CarinaWidget?: typeof CarinaWidget;
  }
}

window.CarinaWidget = CarinaWidget;

function resolveWidgetScript(): HTMLScriptElement | null {
  const current = document.currentScript;
  if (current instanceof HTMLScriptElement) return current;
  const tagged = document.querySelector('script[data-aiva-id]');
  if (tagged instanceof HTMLScriptElement) return tagged;
  const bySrc = document.querySelector('script[src*="widget.js"]');
  if (bySrc instanceof HTMLScriptElement) return bySrc;
  return null;
}

const script = resolveWidgetScript();
const workerId = script?.dataset.aivaId ?? window.CARINA_AIVA_ID;

if (workerId) {
  const overrides: Record<string, string> = {};
  if (script?.dataset.accentColor) overrides.accentColor = script.dataset.accentColor;
  if (script?.dataset.widgetName) overrides.widgetName = script.dataset.widgetName;

  const apiBase = script?.dataset.apiBase ?? 'https://core.carinaai.uk';

  const widget = new CarinaWidget(workerId, { apiBase, overrides });
  void widget.init()
    .then(() => {
      window.dispatchEvent(new CustomEvent('carina-widget-ready', { detail: { workerId } }));
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[Carina widget] Failed to start:', message);
      window.dispatchEvent(
        new CustomEvent('carina-widget-error', { detail: { workerId, message } }),
      );
    });
} else {
  console.error(
    '[Carina widget] Missing worker id. Add data-aiva-id on the script tag or set window.CARINA_AIVA_ID.',
  );
}
