import fs from 'node:fs';
import path from 'node:path';
import { CARINA_HOME } from '../config/paths.js';
import { CAPABILITY_TARGETS } from '../capabilities/audit.js';
import type { BenchmarkTaskDefinition } from './types.js';
import { scoreBoolean, scoreCount, scoreFromMeasure } from './scorer.js';

function numericTarget(category: string, fallback: number): number {
  if (category === 'tools') return CAPABILITY_TARGETS.tools;
  if (category === 'skills') return CAPABILITY_TARGETS.skills;
  if (category === 'channels') return CAPABILITY_TARGETS.channels;
  return fallback;
}

export const BENCHMARK_TASKS: BenchmarkTaskDefinition[] = [
  {
    id: 'tools.registered_count',
    category: 'tools',
    title: 'Registered kernel tools',
    description: 'Count of tools registered in the kernel registry (identical probe for every run).',
    weight: 2,
    regressionMin: 99,
    measure: async () => {
      const { summarizeToolCatalog } = await import('../tools/tool-surface-catalog.js');
      const summary = summarizeToolCatalog();
      return {
        observed: summary.registered,
        unit: 'tools',
        detail: `${summary.totalCatalogued} catalogued, ${summary.optional} optional`,
        metadata: { byCategory: summary.byCategory },
      };
    },
    score: (r) => scoreFromMeasure(r, CAPABILITY_TARGETS.tools, 70),
  },
  {
    id: 'tools.catalog_complete',
    category: 'tools',
    title: 'Tool catalog completeness',
    description: 'All registered tools have metadata and none are missing from the catalog.',
    weight: 1,
    regressionMin: 100,
    measure: async () => {
      const { findCatalogGaps } = await import('../tools/tool-surface-catalog.js');
      const { findUnregisteredTools } = await import('../tools/tool-inventory.js');
      const gaps = findCatalogGaps();
      const missing = findUnregisteredTools();
      const ok = gaps.registeredWithoutMeta.length === 0 && missing.length === 0;
      return {
        observed: ok,
        detail: ok
          ? 'Catalog complete'
          : `gaps: meta=${gaps.registeredWithoutMeta.length}, unregistered=${missing.length}`,
      };
    },
    score: (r) => scoreBoolean(r.observed === true),
  },
  {
    id: 'skills.builtin_count',
    category: 'skills',
    title: 'Built-in procedural skills',
    description: 'Indexed built-in skills across packs.',
    weight: 2,
    regressionMin: 115,
    measure: async () => {
      const { warmPackSkillIndex, getBuiltinSkillNames } = await import('../skills/pack-resolver.js');
      await warmPackSkillIndex();
      const count = getBuiltinSkillNames().size;
      return { observed: count, unit: 'skills' };
    },
    score: (r) => scoreFromMeasure(r, CAPABILITY_TARGETS.skills, 80),
  },
  {
    id: 'skills.eval_harness',
    category: 'skills',
    title: 'Skill eval harness present',
    description: 'Quantitative eval runner and report store ship with the kernel.',
    weight: 1,
    regressionMin: 100,
    measure: async () => {
      const mod = await import('../skills/eval/runner.js');
      const hasRun = typeof mod.runEval === 'function';
      const report = await import('../skills/eval/report.js');
      const hasSave = typeof report.saveReport === 'function';
      return { observed: hasRun && hasSave, detail: 'carina eval run/compare/gate' };
    },
    score: (r) => scoreBoolean(r.observed === true),
  },
  {
    id: 'channels.catalog_count',
    category: 'channels',
    title: 'Channel catalog breadth',
    description: 'Distinct channel adapters discoverable via channel-status.',
    weight: 2,
    regressionMin: 50,
    measure: async () => {
      const { getChannelStatusReports } = await import('../gateway/channels/channel-status.js');
      const reports = getChannelStatusReports();
      return {
        observed: reports.length,
        unit: 'channels',
        metadata: {
          connected: reports.filter((r) => r.state === 'connected').length,
          configured: reports.filter((r) => r.state === 'configured').length,
        },
      };
    },
    score: (r) => scoreFromMeasure(r, CAPABILITY_TARGETS.channels, 30),
  },
  {
    id: 'memory.backend_options',
    category: 'memory',
    title: 'Memory backend options',
    description: 'Shipped memory backends (builtin, sqlite, postgres, honcho, mem0).',
    weight: 1,
    regressionMin: 4,
    measure: async () => {
      const { describeMemoryBackends } = await import('../memory/backends/index.js');
      const backends = describeMemoryBackends();
      return {
        observed: backends.length,
        unit: 'backends',
        detail: backends.map((b) => b.name).join(', '),
      };
    },
    score: (r) => scoreCount(typeof r.observed === 'number' ? r.observed : 0, 5, 2),
  },
  {
    id: 'memory.session_search_tool',
    category: 'memory',
    title: 'Session search tool',
    description: 'Full-text session search tool registered for conversation recall.',
    weight: 1,
    regressionMin: 100,
    measure: async () => {
      const { registry } = await import('../tools/index.js');
      return { observed: registry.get('session-search') != null };
    },
    score: (r) => scoreBoolean(r.observed === true),
  },
  {
    id: 'routing.provider_count',
    category: 'routing',
    title: 'LLM provider registry',
    description: 'Known routable providers in provider-registry.',
    weight: 1,
    regressionMin: 20,
    measure: async () => {
      const { KNOWN_LLM_PROVIDERS } = await import('../brain/provider-registry.js');
      return { observed: KNOWN_LLM_PROVIDERS.length, unit: 'providers' };
    },
    score: (r) => scoreFromMeasure(r, 23, 10),
  },
  {
    id: 'routing.fallback_order',
    category: 'routing',
    title: 'Provider fallback routing',
    description: 'Fallback order builder ships for multi-provider routing.',
    weight: 1,
    regressionMin: 100,
    measure: async () => {
      const { mergeFallbackOrder } = await import('../brain/provider-routing.js');
      const order = mergeFallbackOrder('deepseek', ['anthropic', 'openai']);
      return {
        observed: order.length >= 2 && order[0] === 'deepseek',
        detail: order.slice(0, 5).join(' -> '),
      };
    },
    score: (r) => scoreBoolean(r.observed === true),
  },
  {
    id: 'sessions.profile_isolation',
    category: 'sessions',
    title: 'Profile-scoped sessions',
    description: 'Named profiles with isolated CARINA_HOME paths.',
    weight: 1,
    regressionMin: 100,
    measure: async () => {
      const { describeNamedProfileScope } = await import('../profiles/scope.js');
      const scope = describeNamedProfileScope('default', 'default');
      return {
        observed: Boolean(scope.scoped.carinaHome && scope.runtime.sessionPrefix),
        detail: scope.scoped.carinaHome,
      };
    },
    score: (r) => scoreBoolean(r.observed === true),
  },
  {
    id: 'sessions.gateway_recall',
    category: 'sessions',
    title: 'Gateway session recall API',
    description: 'Gateway router exposes recall and clear for sessions.',
    weight: 1,
    regressionMin: 100,
    measure: async () => {
      const { GatewayRouter } = await import('../gateway/router.js');
      return {
        observed: typeof GatewayRouter.prototype.recall === 'function'
          && typeof GatewayRouter.prototype.clearSession === 'function',
      };
    },
    score: (r) => scoreBoolean(r.observed === true),
  },
  {
    id: 'cron.job_tool',
    category: 'cron',
    title: 'Cron job tool',
    description: 'cronjob tool registered for scheduled automation.',
    weight: 1,
    regressionMin: 100,
    measure: async () => {
      const { registry } = await import('../tools/index.js');
      return { observed: registry.get('cronjob') != null };
    },
    score: (r) => scoreBoolean(r.observed === true),
  },
  {
    id: 'cron.workflow_engine',
    category: 'cron',
    title: 'Cron workflow engine',
    description: 'Multi-step cron workflow parser and engine ship in kernel.',
    weight: 1,
    regressionMin: 100,
    measure: async () => {
      const parser = await import('../agents/cron-workflow-parser.js');
      const engine = await import('../agents/cron-workflow-engine.js');
      return {
        observed: typeof parser.parseWorkflowJson === 'function'
          && typeof engine.executeWorkflow === 'function',
      };
    },
    score: (r) => scoreBoolean(r.observed === true),
  },
  {
    id: 'cron.scheduler',
    category: 'cron',
    title: 'Background cron scheduler',
    description: 'Cron scheduler module loads without error.',
    weight: 1,
    regressionMin: 100,
    measure: async () => {
      const mod = await import('../agents/cron-scheduler.js');
      return { observed: typeof mod.loadAndRegisterAllJobs === 'function' };
    },
    score: (r) => scoreBoolean(r.observed === true),
  },
  {
    id: 'learning.event_store',
    category: 'learning',
    title: 'Learning event store',
    description: 'Append-only learning events for self-improvement loop.',
    weight: 1,
    regressionMin: 100,
    measure: async () => {
      const mod = await import('../skills/learning-events.js');
      return {
        observed: typeof mod.appendLearningEvent === 'function'
          && typeof mod.listLearningEvents === 'function',
      };
    },
    score: (r) => scoreBoolean(r.observed === true),
  },
  {
    id: 'learning.curator',
    category: 'learning',
    title: 'Skill curator pipeline',
    description: 'Curator tool and learning ops for draft promotion.',
    weight: 1,
    regressionMin: 100,
    measure: async () => {
      const { registry } = await import('../tools/index.js');
      const ops = await import('../skills/learning-ops.js');
      return {
        observed: registry.get('skill-curator') != null && typeof ops.listPendingCorrections === 'function',
      };
    },
    score: (r) => scoreBoolean(r.observed === true),
  },
  {
    id: 'learning.cross_agent',
    category: 'learning',
    title: 'Cross-agent learning export',
    description: 'Shared learning signals across workspace agents.',
    weight: 1,
    regressionMin: 100,
    measure: async () => {
      const mod = await import('../skills/cross-agent-learning.js');
      return { observed: typeof mod.propagateSkillAcrossAgents === 'function' };
    },
    score: (r) => scoreBoolean(r.observed === true),
  },
  {
    id: 'security.scout_integration',
    category: 'security',
    title: 'Scout security layer',
    description: 'Tool policy, kill switch, and trust state modules ship in kernel.',
    weight: 2,
    regressionMin: 100,
    measure: async () => {
      const policy = await import('../security/tool-policy-middleware.js');
      const trust = await import('../security/trust-state.js');
      const ks = await import('../security/kill-switch-listener.js');
      return {
        observed: typeof policy.enforceToolPolicy === 'function'
          && typeof trust.buildSecurityTrustState === 'function'
          && typeof ks.checkNotSuspended === 'function',
        detail: 'Scout enforcement path present (enable with LABYRINTH_ENABLED)',
      };
    },
    score: (r) => scoreBoolean(r.observed === true),
  },
  {
    id: 'security.tool_rbac',
    category: 'security',
    title: 'Role-based tool access',
    description: 'Org role gating on tool execution path.',
    weight: 1,
    regressionMin: 100,
    measure: async () => {
      const mod = await import('../security/tool-rbac.js');
      const decision = mod.evaluateToolRbac('shell-exec', 'viewer');
      return {
        observed: typeof mod.evaluateToolRbac === 'function' && decision.allowed === false,
        detail: decision.reason,
      };
    },
    score: (r) => scoreBoolean(r.observed === true),
  },
  {
    id: 'marketplace.hub_catalog',
    category: 'marketplace',
    title: 'Hub marketplace catalog',
    description: 'Builtin marketplace catalog and install flows.',
    weight: 1,
    regressionMin: 100,
    measure: async () => {
      const catalog = await import('../skills/hub/marketplace-catalog.js');
      const install = await import('../skills/hub/marketplace-install.js');
      const built = await catalog.buildMarketplaceCatalog();
      return {
        observed: built.length > 0 && typeof install.marketplaceInstall === 'function',
        unit: 'entries',
        detail: `${built.length} catalog entries`,
      };
    },
    score: (r) => scoreBoolean(r.observed === true),
  },
  {
    id: 'learning.cross_agent_hub',
    category: 'learning',
    title: 'Cross-agent hub sync',
    description: 'Export and sync shared skills via Carina Hub.',
    weight: 1,
    regressionMin: 100,
    measure: async () => {
      const mod = await import('../skills/cross-agent-hub-sync.js');
      return {
        observed: typeof mod.exportSharedSkillsBundle === 'function'
          && typeof mod.syncSharedSkillsFromHub === 'function',
      };
    },
    score: (r) => scoreBoolean(r.observed === true),
  },
  {
    id: 'ecosystem.hub_metrics',
    category: 'marketplace',
    title: 'Hub ecosystem metrics',
    description: 'Measurable marketplace and pack ecosystem summary.',
    weight: 1,
    regressionMin: 100,
    measure: async () => {
      const mod = await import('../skills/hub/ecosystem-metrics.js');
      const metrics = await mod.buildEcosystemMetrics();
      return {
        observed: metrics.marketplace.total > 0,
        unit: 'entries',
        detail: `${metrics.marketplace.total} marketplace entries`,
      };
    },
    score: (r) => scoreBoolean(r.observed === true),
  },
  {
    id: 'certification.built_on',
    category: 'platform',
    title: 'Built on Carina certification',
    description: 'Automated certification checks for partner projects.',
    weight: 1,
    regressionMin: 100,
    measure: async () => {
      const mod = await import('../certification/built-on-carina.js');
      const report = mod.evaluateBuiltOnCarina(process.cwd());
      return {
        observed: typeof mod.evaluateBuiltOnCarina === 'function' && report.checks.length >= 4,
        detail: `score ${report.score}%`,
      };
    },
    score: (r) => scoreBoolean(r.observed === true),
  },
  {
    id: 'enterprise.support_model',
    category: 'platform',
    title: 'Enterprise MIT kernel support model',
    description: 'Red Hat style tiers around free MIT kernel.',
    weight: 1,
    regressionMin: 100,
    measure: async () => {
      const mod = await import('../enterprise/kernel-support.js');
      const offering = mod.describeEnterpriseOffering();
      return {
        observed: offering.kernelLicense === 'MIT' && offering.paidLayers.length >= 2,
        detail: offering.model,
      };
    },
    score: (r) => scoreBoolean(r.observed === true),
  },
];

export function getBenchmarkTask(id: string): BenchmarkTaskDefinition | undefined {
  return BENCHMARK_TASKS.find((task) => task.id === id);
}

export function listBenchmarkTaskIds(): string[] {
  return BENCHMARK_TASKS.map((task) => task.id);
}

export function benchmarkStorageDir(): string {
  return path.join(CARINA_HOME, 'benchmarks');
}

export function ensureBenchmarkStorage(): string {
  const dir = benchmarkStorageDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export { numericTarget };
