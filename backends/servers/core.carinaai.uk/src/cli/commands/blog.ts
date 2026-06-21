import readline from 'node:readline/promises';
import chalk from 'chalk';
import {
  approveIncident,
  createIncident,
  deleteIncident,
  getIncident,
  getLastResearchRun,
  listIncidents,
  listSubscribers,
  publishIncident,
  rejectIncident,
  updateIncident,
} from '../../blog/store.js';
import { generateIncidentPage } from '../../blog/page-generator.js';
import { sendIncidentNewsletter } from '../../blog/newsletter-send.js';
import { runResearchDiscovery } from '../../blog/research-runner.js';
import { loadLocalEnv } from '../config/env.js';
import type { IncidentCategory, IncidentStatus } from '../../blog/types.js';

function flag(args: string[], name: string): boolean {
  return args.includes(name);
}

function flagValue(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx < 0 || !args[idx + 1]) return undefined;
  return args[idx + 1];
}

function parseMaybeNumber(value: string | undefined): number | undefined {
  if (value == null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

async function promptText(rl: readline.Interface, label: string, initial = ''): Promise<string> {
  const suffix = initial ? ` [${initial}]` : '';
  const value = await rl.question(`${label}${suffix}: `);
  return (value.trim() || initial).trim();
}

async function promptBlogIncident(existing?: Awaited<ReturnType<typeof getIncident>>): Promise<{
  title: string;
  slug?: string;
  company: string;
  damage: string;
  category: IncidentCategory;
  dateOccurred: string;
  bodyHtml: string;
  sources: Array<{ label: string; url: string }>;
  scoutFixHtml: string;
}> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const title = await promptText(rl, 'Title', existing?.title ?? '');
    const slug = await promptText(rl, 'Slug', existing?.slug ?? '');
    const company = await promptText(rl, 'Company', existing?.company ?? '');
    const damage = await promptText(rl, 'Damage', existing?.damage ?? '');
    const category = (await promptText(rl, 'Category (financial/security/brand/legal)', existing?.category ?? 'security')) as IncidentCategory;
    const dateOccurred = await promptText(rl, 'Date occurred', existing?.dateOccurred ?? '');
    const bodyHtml = await promptText(rl, 'Body HTML', existing?.bodyHtml ?? '');
    const scoutFixHtml = await promptText(rl, 'Scout fix HTML', existing?.scoutFixHtml ?? '');
    const sourcesRaw = await promptText(rl, 'Sources as label|url;label|url', existing?.sources.map((s) => `${s.label}|${s.url}`).join(';') ?? '');
    const sources = sourcesRaw
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [label, url] = part.split('|').map((chunk) => chunk.trim());
        return { label, url };
      })
      .filter((source) => source.label && source.url);
    return { title, slug: slug || undefined, company, damage, category, dateOccurred, bodyHtml, sources, scoutFixHtml };
  } finally {
    rl.close();
  }
}

function printIncident(incident: Awaited<ReturnType<typeof getIncident>>): void {
  if (!incident) {
    console.log('Not found.');
    return;
  }
  console.log(`${incident.title}`);
  console.log(`  slug: ${incident.slug}`);
  console.log(`  company: ${incident.company}`);
  console.log(`  damage: ${incident.damage}`);
  console.log(`  category: ${incident.category}`);
  console.log(`  date: ${incident.dateOccurred}`);
  console.log(`  status: ${incident.status}`);
  console.log(`  sources: ${incident.sources.map((s) => s.label).join(', ')}`);
  console.log(`  scout fix: ${incident.scoutFixHtml}`);
}

export async function runBlogCommand(args: string[]): Promise<void> {
  loadLocalEnv();
  const json = flag(args, '--json');
  const action = args[0] ?? 'list';

  const output = (value: unknown): void => {
    if (json) {
      console.log(JSON.stringify(value, null, 2));
      return;
    }
    if (typeof value === 'string') console.log(value);
    else console.log(JSON.stringify(value, null, 2));
  };

  if (action === 'list') {
    const status = flagValue(args, '--status') as IncidentStatus | undefined;
    const category = flagValue(args, '--category') as IncidentCategory | undefined;
    const items = await listIncidents({ status, category, limit: parseMaybeNumber(flagValue(args, '--limit')) ?? 100 });
    if (json) {
      output(items);
      return;
    }
    if (items.length === 0) {
      console.log('No incidents.');
      return;
    }
    for (const item of items) {
      console.log(`${item.slug.padEnd(28)} ${item.status.padEnd(10)} ${item.category.padEnd(10)} ${item.company} - ${item.damage}`);
    }
    return;
  }

  if (action === 'show') {
    const id = args[1];
    if (!id) {
      console.error('Usage: carina blog show <slug>');
      process.exit(1);
    }
    const item = await getIncident(id);
    if (json) {
      output(item);
      return;
    }
    printIncident(item);
    return;
  }

  if (action === 'create') {
    const input = await promptBlogIncident();
    const incident = await createIncident({ ...input, status: 'draft' });
    output(incident);
    return;
  }

  if (action === 'edit') {
    const id = args[1];
    if (!id) {
      console.error('Usage: carina blog edit <slug>');
      process.exit(1);
    }
    const existing = await getIncident(id);
    if (!existing) {
      console.error(`Not found: ${id}`);
      process.exit(1);
    }
    const input = await promptBlogIncident(existing);
    const updated = await updateIncident(existing.id, input);
    output(updated);
    return;
  }

  if (action === 'delete') {
    const id = args[1];
    if (!id) {
      console.error('Usage: carina blog delete <slug>');
      process.exit(1);
    }
    output({ deleted: await deleteIncident(id) });
    return;
  }

  if (action === 'approve') {
    const id = args[1];
    if (!id) {
      console.error('Usage: carina blog approve <slug>');
      process.exit(1);
    }
    output(await approveIncident(id, process.env.USER ?? 'carina'));
    return;
  }

  if (action === 'publish') {
    const id = args[1];
    if (!id) {
      console.error('Usage: carina blog publish <slug>');
      process.exit(1);
    }
    output(await publishIncident(id));
    return;
  }

  if (action === 'reject') {
    const id = args[1];
    if (!id) {
      console.error('Usage: carina blog reject <slug> [reason]');
      process.exit(1);
    }
    const reason = args.slice(2).join(' ').trim() || undefined;
    output(await rejectIncident(id, reason));
    return;
  }

  if (action === 'review') {
    const items = await listIncidents({ status: 'draft' });
    output(items);
    return;
  }

  if (action === 'subscribers') {
    const subAction = args[1] ?? 'list';
    if (subAction === 'list') {
      const subscribers = await listSubscribers();
      output(subscribers);
      return;
    }
    if (subAction === 'stats') {
      const subscribers = await listSubscribers();
      output({
        total: subscribers.length,
        confirmed: subscribers.filter((sub) => sub.confirmed && !sub.unsubscribedAt).length,
        unsubscribed: subscribers.filter((sub) => Boolean(sub.unsubscribedAt)).length,
      });
      return;
    }
    console.error('Usage: carina blog subscribers <list|stats>');
    process.exit(1);
  }

  if (action === 'newsletter') {
    if ((args[1] ?? 'send') !== 'send') {
      console.error('Usage: carina blog newsletter send');
      process.exit(1);
    }
    output(await sendIncidentNewsletter());
    return;
  }

  if (action === 'generate-page') {
    output(await generateIncidentPage());
    return;
  }

  if (action === 'research-run') {
    output(await runResearchDiscovery(flagValue(args, '--query') ?? 'AI agent incident 2026'));
    return;
  }

  if (action === 'research-status' || action === 'research-log') {
    output(await getLastResearchRun());
    return;
  }

  if (action === 'search-source') {
    const query = flagValue(args, '--query') ?? args.slice(1).join(' ').trim();
    if (!query) {
      console.error('Usage: carina blog search-source --query "<text>"');
      process.exit(1);
    }
    const hits = await runResearchDiscovery(query);
    output(hits);
    return;
  }

  console.error(`Usage: carina blog <list|show|create|edit|delete|approve|publish|reject|review|subscribers|newsletter|generate-page|research-run|research-status|research-log|search-source>`);
  process.exit(1);
}
