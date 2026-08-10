/**
 * Carina status runtime (file-backed; public HTML hosted on marketing static site).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  StatusStore,
  runHealthCycle,
  manualCreateIncident,
  manualUpdateIncident,
  scheduleMaintenance,
  maintenanceCalendar,
  autoNotifyBeforeMaintenance,
  notifyActiveUsers,
  notifySubscribers,
  NotificationLog,
  buildStatusPageModel,
  renderStatusPageHtml,
  type MonitoredEndpoint,
  type EmailSender,
  type PingFn,
} from './index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA = path.resolve(HERE, '../../../data/status/status-store.json');

const DEFAULT_ENDPOINTS: MonitoredEndpoint[] = [
  {
    id: 'carina-app-health',
    name: 'Carina app API',
    url: process.env.CARINA_STATUS_APP_HEALTH_URL || 'https://app.carinaai.uk/api/health',
  },
  {
    id: 'carina-marketing',
    name: 'Carina marketing',
    url: process.env.CARINA_STATUS_MARKETING_URL || 'https://carinaai.uk/',
  },
];

let store: StatusStore | null = null;
export const notificationLog = new NotificationLog();

export function getStatusStore(): StatusStore {
  if (!store) {
    const filePath = process.env.CARINA_STATUS_STORE_PATH || DEFAULT_DATA;
    store = new StatusStore({
      filePath,
      product: 'carina',
      endpoints: DEFAULT_ENDPOINTS,
    });
    if (store.listEndpoints().length === 0) {
      store.setEndpoints(DEFAULT_ENDPOINTS);
    }
  }
  return store;
}

export function resetStatusStoreForTests(): void {
  store = null;
}

export async function tickStatusHealth(opts?: { pingFn?: PingFn; now?: string }) {
  return runHealthCycle(getStatusStore(), opts);
}

export function renderCarinaStatusHtml(): string {
  const model = buildStatusPageModel(getStatusStore());
  const navHtml = `<nav style="position:fixed;top:0;left:0;right:0;height:64px;background:rgba(9,22,30,.92);backdrop-filter:blur(16px);border-bottom:1px solid rgba(26,95,122,.12);z-index:20">
  <div style="max-width:900px;margin:0 auto;height:100%;display:flex;align-items:center;justify-content:space-between;padding:0 1.5rem">
    <a href="/" style="color:#fff;text-decoration:none;font-family:Georgia,serif;font-size:1.35rem">Carina</a>
    <div style="display:flex;gap:1.2rem;align-items:center">
      <a href="/use-cases/" style="color:#7a9daf;text-decoration:none;font-size:.875rem">Use cases</a>
      <a href="/security/" style="color:#7a9daf;text-decoration:none;font-size:.875rem">Security</a>
      <a href="/pricing/" style="color:#7a9daf;text-decoration:none;font-size:.875rem">Pricing</a>
      <a href="/proof/" style="color:#7a9daf;text-decoration:none;font-size:.875rem">Proof</a>
      <a href="/status/" style="color:#f5a623;text-decoration:none;font-size:.875rem">Status</a>
      <a href="/docs/" style="color:#7a9daf;text-decoration:none;font-size:.875rem">Docs</a>
    </div>
  </div>
</nav>`;
  return renderStatusPageHtml(model, {
    brand: 'Carina',
    title: 'Status; Carina AI',
    canonicalUrl: 'https://carinaai.uk/status',
    navHtml,
    hostingNote:
      'Hosted on Carina marketing static infrastructure (carinaai.uk), separate from app.carinaai.uk runtime.',
  });
}

export async function notifyIncidentDetected(
  incidentId: string,
  opts?: { activeUsers?: string[]; subscribers?: string[]; sender?: EmailSender },
) {
  const incident = getStatusStore().getIncident(incidentId);
  if (!incident) return null;
  const active = opts?.activeUsers || [];
  const subs = opts?.subscribers || [];
  const out = [];
  if (active.length) {
    out.push(await notifyActiveUsers(incident, active, { sender: opts?.sender, log: notificationLog, kind: 'detected' }));
  }
  if (subs.length) {
    out.push(await notifySubscribers(incident, subs, { sender: opts?.sender, log: notificationLog, kind: 'detected' }));
  }
  return out;
}

export {
  manualCreateIncident,
  manualUpdateIncident,
  scheduleMaintenance,
  maintenanceCalendar,
  autoNotifyBeforeMaintenance,
  buildStatusPageModel,
};
