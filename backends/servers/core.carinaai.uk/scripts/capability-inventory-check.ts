import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registry } from '../src/tools/index.js';
import { PLATFORM_NAMES } from '../src/tools/toolset-config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const coreRoot = path.resolve(__dirname, '..');
const baselinePath = path.join(coreRoot, 'qa/capability-inventory-baseline.json');
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8')) as {
  minTools: number;
  minChannelAdapters: number;
  minProviders: number;
  docPath: string;
};

const toolCount = registry.list().length;
const channelAdapters = PLATFORM_NAMES.filter(
  (name) => !['default', 'api', 'mcp', 'webhooks', 'cron'].includes(name),
).length;

const docPath = path.resolve(coreRoot, baseline.docPath);
const docText = fs.existsSync(docPath) ? fs.readFileSync(docPath, 'utf8') : '';
const failures: string[] = [];

if (toolCount < baseline.minTools) {
  failures.push(`tools: registry has ${toolCount}, baseline min ${baseline.minTools}`);
}
if (channelAdapters < baseline.minChannelAdapters) {
  failures.push(
    `channels: ${channelAdapters} platform adapters, baseline min ${baseline.minChannelAdapters}`,
  );
}

const providerMatch = docText.match(/(\d+)\s+LLM providers/i);
const docProviders = providerMatch ? Number(providerMatch[1]) : baseline.minProviders;
if (docProviders < baseline.minProviders) {
  failures.push(`providers: doc claims ${docProviders}, baseline min ${baseline.minProviders}`);
}

if (failures.length > 0) {
  console.error('Capability inventory check failed:');
  for (const line of failures) console.error(`- ${line}`);
  console.error('Update qa/capability-inventory-baseline.json if counts changed intentionally.');
  process.exit(1);
}

console.log(
  `Capability inventory OK: ${toolCount} tools, ${channelAdapters} channel adapters, doc providers ${docProviders}`,
);
