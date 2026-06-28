import { CarinaWidget } from './widget';

declare global {
  interface Window {
    CARINA_AIVA_ID?: string;
    CarinaWidget?: typeof CarinaWidget;
  }
}

window.CarinaWidget = CarinaWidget;

const script = document.currentScript as HTMLScriptElement | null;
const workerId = script?.dataset.aivaId ?? window.CARINA_AIVA_ID;

if (workerId) {
  const overrides: Record<string, string> = {};
  if (script?.dataset.accentColor) overrides.accentColor = script.dataset.accentColor;
  if (script?.dataset.widgetName) overrides.widgetName = script.dataset.widgetName;

  const apiBase = script?.dataset.apiBase ?? 'https://core.carinaai.uk';

  const widget = new CarinaWidget(workerId, { apiBase, overrides });
  void widget.init();
}
