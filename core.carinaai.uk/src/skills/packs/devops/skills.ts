import type { PackSkillInput } from '../../pack-types.js';

export const devopsSkills: PackSkillInput[] = [
  {
    name: 'kanban-sprint',
    description: 'Run multi-agent sprints on a Kanban board',
    trigger: ['kanban sprint', 'agent queue', 'board heartbeat', 'unblock card'],
    steps: '1. kanban-show current board.\n2. kanban-create tasks.\n3. kanban-assign or delegate-task.\n4. kanban-heartbeat for stale items.',
    toolsUsed: ['kanban-show', 'kanban-create', 'kanban-heartbeat', 'delegate-task'],
  },
  {
    name: 'ci-debug',
    description: 'Debug failing CI pipelines from logs',
    trigger: ['ci failed', 'pipeline error', 'github actions fail'],
    steps: '1. Fetch logs via http-request or shell-exec gh.\n2. Identify failing step.\n3. Propose minimal fix.',
    toolsUsed: ['http-request', 'shell-exec', 'file-read'],
  },
  {
    name: 'docker-compose-ops',
    description: 'Operate docker compose stacks',
    trigger: ['docker compose', 'container logs', 'restart service'],
    steps: '1. Inspect compose file.\n2. shell-exec docker compose ps/logs.\n3. Confirm before restart.',
    toolsUsed: ['file-read', 'shell-exec'],
  },
  {
    name: 'k8s-troubleshoot',
    description: 'Basic Kubernetes troubleshooting',
    trigger: ['kubernetes', 'kubectl', 'pod crash', 'k8s debug'],
    steps: '1. kubectl get/describe/logs via shell-exec.\n2. Summarize events.\n3. Suggest remediation.',
    toolsUsed: ['shell-exec'],
  },
  {
    name: 'webhook-integrations',
    description: 'Wire external systems via webhooks',
    trigger: ['webhook subscribe', 'event hook', 'integration webhook'],
    steps: '1. webhook tool to register endpoint.\n2. Document payload shape.\n3. Test with http-request.',
    toolsUsed: ['webhook', 'http-request'],
  },
  {
    name: 'deploy-checklist',
    description: 'Pre-deploy verification checklist',
    trigger: ['deploy checklist', 'release prep', 'pre-deploy'],
    steps: '1. Run pnpm test/build via shell-exec.\n2. checkpoint-manager before deploy.\n3. Summarize blockers.',
    toolsUsed: ['shell-exec', 'checkpoint-manager'],
  },
  {
    name: 'backup-migration',
    description: 'Migrate Carina data between machines with verified archives',
    trigger: ['migrate carina', 'move install', 'transfer backup', 'new machine setup'],
    steps: `1. carina backup create on source; copy archive securely.
2. carina backup verify on target before restore.
3. carina doctor on target after restore.
4. Re-enter channel tokens via env; never bundle secrets in archives.`,
    toolsUsed: ['shell-exec'],
  },
  {
    name: 'disk-space-reclamation',
    description: 'Find and reclaim disk space safely on the host',
    trigger: ['disk full', 'free space', 'clean logs', 'storage cleanup'],
    steps: `1. shell-exec df -h and du on large dirs under CARINA_HOME and project roots.
2. Identify logs, node_modules, old backups; confirm before delete.
3. carina backup list; prune only after operator confirms retention policy.
4. Never rm -rf without explicit approval.`,
    toolsUsed: ['shell-exec', 'search-files'],
  },
  {
    name: 'server-troubleshooting',
    description: 'Structured triage for service outages and port conflicts',
    trigger: ['service down', 'port in use', 'cannot connect', 'server troubleshoot'],
    steps: `1. Confirm symptom: URL, port, error message.
2. shell-exec ss -lntp or lsof for port owners; systemctl/docker status if applicable.
3. Tail recent logs; propose minimal restart only after checkpoint or backup.
4. Document root cause in notes-manage if recurring.`,
    toolsUsed: ['shell-exec', 'http-request', 'notes-manage'],
  },
];
