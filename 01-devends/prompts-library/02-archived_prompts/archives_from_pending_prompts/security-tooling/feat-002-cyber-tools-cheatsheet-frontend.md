# FEAT 001 (Part B): Cyber tools cheatsheet page - Next.js frontend

**Status: COMPLETED 2026-06-26**

**What was built:**
- `03-frontends/client-apps/app.carinaai.uk/src/lib/cyber-tools-core.ts`: core proxy client plus registry-synced dev stub
- `03-frontends/client-apps/app.carinaai.uk/scripts/sync-cyber-tools-stub.mjs`: regenerates stub from backend registry on build
- `03-frontends/client-apps/app.carinaai.uk/src/app/api/security/tools/route.ts` and `health/route.ts`
- `03-frontends/client-apps/app.carinaai.uk/src/app/(workspace)/security/tools/page.tsx`
- `03-frontends/client-apps/app.carinaai.uk/src/components/security/CyberToolsCheatsheet.tsx`
- `03-frontends/client-apps/app.carinaai.uk/src/lib/workspace-nav.ts`: `/security/tools` nav entry

**Sprint:** Security tooling
**Prompt number:** 001-B
**Name:** `/security/tools` cheatsheet: 72 tools, trigger phrases, tier locks, binary health
**Primary agent:** Cursor
**Estimated hours:** 3 h
**Depends on:** `feat-001-cyber-tools-api-backend.md` (COMPLETED 2026-06-26)

---

## Context

The Carina backend now exposes two internal endpoints:

- `GET /api/tools/cyber` - full tool catalogue (name, category, tier, binary, description,
  triggers, upgradeNote)
- `GET /api/tools/cyber/health` - which binaries are installed on the Carina host

The frontend app at `app.carinaai.uk` is a Next.js 14 app (App Router). It uses:

- TypeScript, Tailwind CSS (no external component libraries beyond what already exists)
- Existing UI primitives: `@/components/ui/button`, `@/components/ui/input`,
  `@/components/ui/EmptyState`, `@/components/ui/Tooltip`, `@/components/ui/IconButton`
- Existing proxy pattern: `@/lib/core-proxy` exports `coreProxyEnabled()`,
  `resolveCoreUrl()`, `resolveCoreProxyToken()`
- Existing auth pattern: `getSession()` from `@/lib/session`, `requireSession()` for protected pages
- Tailwind color tokens already used throughout: `bg-surface`, `bg-elevated`, `border-border`,
  `text-text-primary`, `text-text-secondary`, `text-text-muted`, `text-accent`, `text-danger`

There is already a `/security` page. This adds a sub-page `/security/tools`.

The page has **two modes**:

1. **Connected mode** (`CARINA_USE_CORE_PROXY=true` and `CARINA_CORE_URL` set): fetches
   live data from the Carina backend and shows real health status.
2. **Stub mode** (core not configured): renders the static tool list embedded directly
   in the frontend with health shown as "unknown". Everything except health is still useful.

---

## Files to create or edit

| Action | File |
|--------|------|
| Create | `src/lib/cyber-tools-core.ts` |
| Create | `src/app/api/security/tools/route.ts` |
| Create | `src/app/api/security/tools/health/route.ts` |
| Create | `src/app/(workspace)/security/tools/page.tsx` |
| Create | `src/components/security/CyberToolsCheatsheet.tsx` |
| Edit | `src/lib/workspace-nav.ts` |

---

## Shared type (embed at the top of `cyber-tools-core.ts` - also import in the component)

```typescript
export type CyberTool = {
  name: string;
  category: string;
  requiredTier: string;
  binary: string;
  description: string;
  triggers: string[];
  upgradeNote: string | null;
};

export type CyberToolHealth = {
  name: string;
  binary: string;
  installed: boolean;
};
```

---

## File 1 - create `src/lib/cyber-tools-core.ts`

This is the proxy helper. Mirror the pattern in `src/lib/security-dashboard-core.ts`.

```typescript
import { coreProxyEnabled, resolveCoreUrl, resolveCoreProxyToken } from '@/lib/core-proxy';
import type { CyberTool, CyberToolHealth } from './cyber-tools-core.js';

export { CyberTool, CyberToolHealth };

export function cyberToolsCoreConfigured(): boolean {
  return coreProxyEnabled();
}

async function callCore(path: string): Promise<Response> {
  const base = resolveCoreUrl().replace(/\/$/, '');
  const token = resolveCoreProxyToken();
  return fetch(`${base}${path}`, {
    headers: { 'x-internal-key': token },
    cache: 'no-store',
  });
}

export async function fetchCyberToolsFromCore(): Promise<{ tools: CyberTool[]; total: number }> {
  const res = await callCore('/api/tools/cyber');
  if (!res.ok) throw new Error(`Cyber tools fetch failed: HTTP ${res.status}`);
  return res.json() as Promise<{ tools: CyberTool[]; total: number }>;
}

export async function fetchCyberToolHealthFromCore(): Promise<{
  health: CyberToolHealth[];
  installedCount: number;
  total: number;
}> {
  const res = await callCore('/api/tools/cyber/health');
  if (!res.ok) throw new Error(`Cyber tool health fetch failed: HTTP ${res.status}`);
  return res.json() as Promise<{ health: CyberToolHealth[]; installedCount: number; total: number }>;
}

export function buildCyberToolsStub(): CyberTool[] {
  return STATIC_CYBER_TOOLS;
}
```

After the `buildCyberToolsStub` function, paste the `STATIC_CYBER_TOOLS` constant defined
at the bottom of this prompt.

---

## File 2 - create `src/app/api/security/tools/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import {
  cyberToolsCoreConfigured,
  fetchCyberToolsFromCore,
  buildCyberToolsStub,
} from '@/lib/cyber-tools-core';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    if (cyberToolsCoreConfigured()) {
      const data = await fetchCyberToolsFromCore();
      return NextResponse.json({ ...data, source: 'core' });
    }
    const tools = buildCyberToolsStub();
    return NextResponse.json({
      tools,
      total: tools.length,
      source: 'stub',
      warning: 'Set CARINA_USE_CORE_PROXY=true with CARINA_CORE_URL for live data.',
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
```

---

## File 3 - create `src/app/api/security/tools/health/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import {
  cyberToolsCoreConfigured,
  fetchCyberToolHealthFromCore,
} from '@/lib/cyber-tools-core';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!cyberToolsCoreConfigured()) {
    return NextResponse.json({
      health: [],
      installedCount: 0,
      total: 0,
      source: 'stub',
      warning: 'Core proxy not configured. Health check unavailable.',
    });
  }

  try {
    const data = await fetchCyberToolHealthFromCore();
    return NextResponse.json({ ...data, source: 'core' });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
```

---

## File 4 - create `src/app/(workspace)/security/tools/page.tsx`

```typescript
import { CyberToolsCheatsheet } from '@/components/security/CyberToolsCheatsheet';

export const dynamic = 'force-dynamic';

export default function SecurityToolsPage() {
  return <CyberToolsCheatsheet />;
}
```

---

## File 5 - create `src/components/security/CyberToolsCheatsheet.tsx`

This is the main client component. Build it as described in the UI spec below.

### UI spec

**Container:** `max-w-7xl mx-auto p-4 sm:p-6 space-y-6`

**Header block:**

```
Security tools            [Refresh health]
Cheatsheet of all 72 tools Carina can use.
Prompt any of the trigger phrases to invoke a tool.
```

Title: `text-2xl font-semibold text-text-primary`
Subtitle: `text-sm text-text-secondary mt-1`
Refresh button: small bordered button, runs the health fetch again. Shows a spinner while
loading. Label: "Refresh health". Only show this button if the source is `'core'` (not
stub mode).

**Stats strip** (four cards in a row, same style as MetricCard in SecurityDashboardClient):

| Card | Value |
|------|-------|
| Total tools | `72` (from API `total`) |
| Installed | `N / 72` (from health response, `installedCount`) - show `--` if stub mode |
| Your tier | resolved from `NEXT_PUBLIC_CARINA_TIER` env or `'self-hosted'` if unset |
| Unlocked | Count of tools where `requiredTier` is accessible at the current tier (see tier order below) |

Tier order (lowest to highest): `self-hosted` (0), `cloud` (1), `monitor` (2),
`govern` (3), `enterprise` (4).

A tool is unlocked if `TIER_ORDER[tool.requiredTier] <= TIER_ORDER[currentTier]`.

**Filter bar** (below stats):

- Text input: placeholder `"Search by name or trigger phrase..."` - filters the tool list
  by name or any trigger string (case-insensitive substring)
- Category dropdown: `<select>` or clickable chip row with `All categories` + each unique
  `category` value from the list. Use chips. Active chip has `bg-accent text-white` style.
- Tier filter chips: `All tiers` | `self-hosted` | `cloud` | `monitor` | `govern`. Same
  chip style. This filters to show only tools whose `requiredTier` matches the selected
  tier (not "unlocked at tier", but "requires exactly this tier").
- Show locked toggle: checkbox or toggle, default `true`. When unchecked, hide tools that
  are above the user's current tier.

**Category chip labels** (display names for the raw category strings):

| Raw value | Display label |
|---|---|
| `reconnaissance` | Reconnaissance |
| `vulnerability-scanning` | Vulnerability scanning |
| `exploitation` | Exploitation |
| `web-application-testing` | Web app testing |
| `wireless-network` | Wireless |
| `forensics-imaging` | Forensics |
| `sniffing-traffic` | Traffic analysis |
| `privacy-opsec` | Privacy / OPSEC |
| `reverse-engineering` | Reverse engineering |
| `blue-team-defense` | Blue team |
| `reporting-tip` | Reporting / TIP |
| `utility` | Utility |

**Tool table**

Render as a responsive table with these columns. On mobile (< 768px), collapse to cards.

| Column | Content |
|--------|---------|
| Tool | Name in `font-mono text-sm font-semibold` + category label below in `text-xs text-text-muted` |
| Tier | Badge chip. Colors: `self-hosted`=`bg-surface border-border text-text-secondary`, `cloud`=`bg-blue-500/10 text-blue-400 border-blue-500/20`, `monitor`=`bg-amber-500/10 text-amber-400 border-amber-500/20`, `govern`=`bg-purple-500/10 text-purple-400 border-purple-500/20`. Add a lock icon (`LockIcon` from lucide-react) next to the badge when the tool is above the user's tier. |
| Binary | `font-mono text-xs text-text-muted` |
| Description | `text-sm text-text-secondary` wrapping text |
| Trigger phrases | Each trigger string as a small copyable chip. Chip style: `bg-elevated border border-border rounded px-1.5 py-0.5 text-xs font-mono cursor-pointer hover:bg-surface-hover`. Clicking copies the phrase to clipboard and shows a brief "Copied" tooltip (1.5 s). |
| Health | Green dot + "Installed", red dot + "Missing", or grey dot + "Unknown". Dot is `h-2 w-2 rounded-full inline-block mr-1.5`. Colors: green=`bg-green-400`, red=`bg-red-400`, grey=`bg-text-muted`. Show "Unknown" when health data is not available (stub mode or health not yet fetched). |

Row style: `border-b border-border last:border-0`. Locked rows (above user tier) should
have `opacity-50` applied to the entire row.

If a tool has an `upgradeNote` (not null), show a small info icon after the description
that reveals the note in a `Tooltip`.

**Loading and error states:**

- While the tool list is loading: `EmptyState` with title `"Loading tools"` and subtitle
  `"Fetching tool catalogue..."`.
- If the tool fetch fails: `EmptyState` with title `"Could not load tools"` and subtitle
  showing the error message.
- While health is loading: show the tool table immediately (health column shows grey "Unknown"
  dots), then update the health column in-place when the health fetch resolves. Do not block
  the tool list render on the health fetch.

**Stub mode banner:**

When `source === 'stub'`, show a banner below the filter bar:

```
Core proxy not configured. Tool list is static. Health status is unavailable.
Set CARINA_USE_CORE_PROXY=true and CARINA_CORE_URL to connect live data.
```

Style: `rounded-lg border border-border bg-surface p-3 text-xs text-text-secondary`.

---

### Data fetching strategy

Use two separate `useEffect` calls on mount:

1. `fetchTools()` - calls `GET /api/security/tools` and sets `tools` state
2. `fetchHealth()` - calls `GET /api/security/tools/health` and sets `health` state (keyed
   by tool name: `Record<string, boolean>`)

Both run in parallel (do NOT await one before starting the other). Health updates the
column in-place without re-rendering the whole table.

---

### Full component skeleton

```typescript
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Info, Lock } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tooltip } from '@/components/ui/Tooltip';
import type { CyberTool } from '@/lib/cyber-tools-core';

// ... component implementation per spec above
```

Do not use any external charting or table libraries. Vanilla React + Tailwind only.

---

## File 6 - edit `src/lib/workspace-nav.ts`

Add one new route entry in the `NAV_ROUTES` array. Find the existing Security route
(`href: '/security'`) and insert a new entry immediately after it:

```typescript
{
  href: '/security/tools',
  label: 'Security tools',
  description: 'Cheatsheet of all 72 security tools, trigger phrases, and binary health.',
  group: 'account',
  iconName: 'Terminal',
},
```

Do not change any other nav entry.

---

## `STATIC_CYBER_TOOLS` constant

Paste this verbatim at the bottom of `src/lib/cyber-tools-core.ts`. It is the static
fallback used in stub mode. The data is authoritative as of 2026-06-26 from
`src/tools/cyber-tools-registry.ts` in the Carina backend.

```typescript
const STATIC_CYBER_TOOLS: CyberTool[] = [
  // Reconnaissance - self-hosted
  { name: 'nmap', category: 'reconnaissance', requiredTier: 'self-hosted', binary: 'nmap', description: 'Network discovery; ports, services, OS, and vulnerability scripts.', triggers: ['scan ports', 'port scan', 'nmap', 'recon scan'], upgradeNote: 'Advanced NSE scripts and vulnerability scanning require Cloud Carina.' },
  { name: 'amass', category: 'reconnaissance', requiredTier: 'self-hosted', binary: 'amass', description: 'Subdomain enumeration via passive and active recon.', triggers: ['find subdomains', 'subdomain enumeration', 'amass'], upgradeNote: 'Vulnerability scanning on discovered subdomains requires Cloud Carina.' },
  { name: 'theHarvester', category: 'reconnaissance', requiredTier: 'self-hosted', binary: 'theHarvester', description: 'Email, subdomain, and name harvesting from public sources.', triggers: ['find emails', 'harvest emails', 'theHarvester', 'osint harvest'], upgradeNote: null },
  { name: 'recon-ng', category: 'reconnaissance', requiredTier: 'self-hosted', binary: 'recon-ng', description: 'Structured OSINT framework with modular discovery workflows.', triggers: ['recon-ng', 'recon framework', 'osint framework'], upgradeNote: null },
  { name: 'spiderfoot', category: 'reconnaissance', requiredTier: 'self-hosted', binary: 'sf', description: 'Automated OSINT with 200+ modules for domains, IPs, and emails.', triggers: ['spiderfoot', 'automated osint'], upgradeNote: null },
  { name: 'sherlock', category: 'reconnaissance', requiredTier: 'self-hosted', binary: 'sherlock', description: 'Username search across social networks and websites.', triggers: ['sherlock', 'username search', 'find username'], upgradeNote: null },
  { name: 'maltego', category: 'reconnaissance', requiredTier: 'self-hosted', binary: 'maltego', description: 'Graph-based OSINT link analysis and entity relationship mapping.', triggers: ['maltego', 'graph osint', 'link analysis'], upgradeNote: null },
  { name: 'dmitry', category: 'reconnaissance', requiredTier: 'self-hosted', binary: 'dmitry', description: 'All-in-one WHOIS, subdomain, email, port, and banner gathering.', triggers: ['dmitry', 'deepmagic', 'whois scan'], upgradeNote: null },
  { name: 'metagoofil', category: 'reconnaissance', requiredTier: 'self-hosted', binary: 'metagoofil', description: 'Extract metadata from public documents found via search engines.', triggers: ['metagoofil', 'document metadata', 'metadata extract'], upgradeNote: null },
  { name: 'cewl', category: 'reconnaissance', requiredTier: 'self-hosted', binary: 'cewl', description: 'Spider a website and generate a targeted wordlist.', triggers: ['cewl', 'wordlist', 'custom wordlist'], upgradeNote: null },
  { name: 'shodan', category: 'reconnaissance', requiredTier: 'self-hosted', binary: 'shodan', description: 'Search internet-connected devices (requires SHODAN_API_KEY in env).', triggers: ['shodan search', 'search shodan'], upgradeNote: 'Automated vulnerability scanning against Shodan results requires Cloud Carina.' },
  { name: 'censys', category: 'reconnaissance', requiredTier: 'self-hosted', binary: 'censys', description: 'Internet asset discovery (requires censys CLI and credentials).', triggers: ['censys search', 'censys'], upgradeNote: null },
  { name: 'masscan', category: 'reconnaissance', requiredTier: 'self-hosted', binary: 'masscan', description: 'Fast port scanner for large ranges.', triggers: ['mass scan', 'masscan', 'fast port scan'], upgradeNote: 'Vulnerability assessment on discovered services requires Cloud Carina.' },
  { name: 'curl', category: 'utility', requiredTier: 'self-hosted', binary: 'curl', description: 'HTTP client for fetching URLs and testing endpoints.', triggers: ['curl', 'fetch url', 'http request'], upgradeNote: null },
  { name: 'netcat', category: 'utility', requiredTier: 'self-hosted', binary: 'nc', description: 'TCP connection tool for port testing and banner grabbing.', triggers: ['netcat', 'nc', 'connect to port'], upgradeNote: null },
  // Vulnerability scanning - cloud
  { name: 'nuclei', category: 'vulnerability-scanning', requiredTier: 'cloud', binary: 'nuclei', description: 'Template-based vulnerability scanner; CVEs, misconfigs, exposures, secrets.', triggers: ['scan vulnerabilities', 'nuclei scan', 'cve scan', 'vuln scan'], upgradeNote: 'Exploitation of discovered vulnerabilities requires Scout Monitor.' },
  { name: 'nikto', category: 'vulnerability-scanning', requiredTier: 'cloud', binary: 'nikto', description: 'Web server scanner; dangerous files, outdated versions, misconfigs.', triggers: ['nikto', 'web server scan', 'vuln web'], upgradeNote: null },
  { name: 'sqlmap', category: 'vulnerability-scanning', requiredTier: 'cloud', binary: 'sqlmap', description: 'Automated SQL injection detection and exploitation.', triggers: ['sqlmap', 'sqli', 'sql injection'], upgradeNote: 'Data extraction and high-risk tests require explicit approval.' },
  { name: 'wpscan', category: 'vulnerability-scanning', requiredTier: 'cloud', binary: 'wpscan', description: 'WordPress plugin, theme, user, and vulnerability scanner.', triggers: ['wpscan', 'wordpress scan', 'vuln wordpress'], upgradeNote: null },
  { name: 'whatweb', category: 'vulnerability-scanning', requiredTier: 'cloud', binary: 'whatweb', description: 'Web technology fingerprinting for 1800+ technologies.', triggers: ['whatweb', 'tech fingerprint', 'vuln fingerprint'], upgradeNote: null },
  { name: 'yersinia', category: 'vulnerability-scanning', requiredTier: 'cloud', binary: 'yersinia', description: 'Layer 2 protocol testing; STP, CDP, DTP, DHCP, HSRP, VTP, 802.1x.', triggers: ['yersinia', 'layer2', 'stp attack'], upgradeNote: 'Attack mode can disrupt network segments. Requires authorization.' },
  { name: 'legion', category: 'vulnerability-scanning', requiredTier: 'cloud', binary: 'legion', description: 'Automated network assessment; scan, enumerate, brute force, screenshots.', triggers: ['legion', 'network assess', 'vuln assess'], upgradeNote: null },
  // Exploitation - monitor
  { name: 'metasploit', category: 'exploitation', requiredTier: 'monitor', binary: 'msfconsole', description: 'Exploitation framework; module run, suggest, and post-exploitation via msfconsole.', triggers: ['metasploit', 'msfconsole', 'exploit run', 'exploit suggest'], upgradeNote: 'Active exploitation requires Scout Monitor authorization and scope confirmation.' },
  { name: 'impacket', category: 'exploitation', requiredTier: 'monitor', binary: 'impacket-secretsdump', description: 'Windows protocol tools; secretsdump, psexec, wmiexec, Kerberos attacks.', triggers: ['impacket', 'secretsdump', 'psexec', 'kerberoast'], upgradeNote: null },
  { name: 'hydra', category: 'exploitation', requiredTier: 'monitor', binary: 'hydra', description: 'Network login brute-forcer for 50+ protocols.', triggers: ['hydra', 'brute force', 'password spray'], upgradeNote: null },
  { name: 'john', category: 'exploitation', requiredTier: 'monitor', binary: 'john', description: 'CPU password hash cracker with wordlists and rules.', triggers: ['john', 'crack hash', 'password crack'], upgradeNote: null },
  { name: 'hashcat', category: 'exploitation', requiredTier: 'monitor', binary: 'hashcat', description: 'GPU-accelerated password hash cracker.', triggers: ['hashcat', 'gpu crack', 'hash crack'], upgradeNote: null },
  { name: 'evil-winrm', category: 'exploitation', requiredTier: 'monitor', binary: 'evil-winrm', description: 'WinRM PowerShell shell with pass-the-hash support.', triggers: ['evil-winrm', 'winrm shell', 'winrm exploit'], upgradeNote: null },
  { name: 'crackmapexec', category: 'exploitation', requiredTier: 'monitor', binary: 'crackmapexec', description: 'Multi-protocol post-exploitation; SMB, WinRM, LDAP, MSSQL, SSH.', triggers: ['crackmapexec', 'cme', 'lateral movement'], upgradeNote: null },
  { name: 'mimikatz', category: 'exploitation', requiredTier: 'monitor', binary: 'msfconsole', description: 'Credential extraction via meterpreter kiwi/mimikatz modules.', triggers: ['mimikatz', 'credential dump', 'lsass dump'], upgradeNote: 'Requires an active elevated meterpreter session.' },
  // Web app testing - monitor
  { name: 'burpsuite', category: 'web-application-testing', requiredTier: 'monitor', binary: 'burpsuite', description: 'Burp Suite Pro REST scanning and proxy control.', triggers: ['burpsuite', 'burp scan', 'web scan'], upgradeNote: 'REST API requires Burp Suite Pro with BURP_API_URL configured.' },
  { name: 'ffuf', category: 'web-application-testing', requiredTier: 'monitor', binary: 'ffuf', description: 'Fast web fuzzer for directories, vhosts, and parameters.', triggers: ['ffuf', 'web fuzz', 'fuzz dirs'], upgradeNote: null },
  { name: 'dirsearch', category: 'web-application-testing', requiredTier: 'monitor', binary: 'dirsearch', description: 'Recursive web path scanner with extension lists.', triggers: ['dirsearch', 'path scan'], upgradeNote: null },
  { name: 'feroxbuster', category: 'web-application-testing', requiredTier: 'monitor', binary: 'feroxbuster', description: 'Rust recursive content discovery tool.', triggers: ['feroxbuster', 'recursive fuzz'], upgradeNote: null },
  { name: 'gobuster', category: 'web-application-testing', requiredTier: 'monitor', binary: 'gobuster', description: 'Directory, DNS, vhost, and S3 enumeration.', triggers: ['gobuster', 'dir bust', 'dns bust'], upgradeNote: null },
  { name: 'arjun', category: 'web-application-testing', requiredTier: 'monitor', binary: 'arjun', description: 'Hidden HTTP parameter discovery.', triggers: ['arjun', 'param discovery', 'fuzz params'], upgradeNote: null },
  { name: 'sstimap', category: 'web-application-testing', requiredTier: 'monitor', binary: 'sstimap', description: 'Server-side template injection detection and exploitation.', triggers: ['sstimap', 'ssti', 'template injection'], upgradeNote: 'OS shell mode attempts RCE and requires explicit approval.' },
  // Wireless - monitor
  { name: 'aircrack-ng', category: 'wireless-network', requiredTier: 'monitor', binary: 'aircrack-ng', description: 'WiFi auditing; packet capture, WPA/WEP cracking, and deauth.', triggers: ['aircrack', 'wifi crack', 'wpa crack', 'wireless audit'], upgradeNote: 'Wireless attacks require authorization and monitor-mode hardware.' },
  { name: 'bettercap', category: 'wireless-network', requiredTier: 'monitor', binary: 'bettercap', description: 'MITM framework; ARP/DNS spoofing, HTTP/HTTPS proxy, WiFi recon.', triggers: ['bettercap', 'mitm', 'arp spoof', 'credential harvest'], upgradeNote: 'MITM modules intercept live traffic and require explicit approval.' },
  { name: 'kismet', category: 'wireless-network', requiredTier: 'monitor', binary: 'kismet', description: 'Passive WiFi, Bluetooth, and SDR discovery via Kismet REST API.', triggers: ['kismet', 'wifi discover', 'passive wireless', 'wireless recon'], upgradeNote: null },
  { name: 'wifite', category: 'wireless-network', requiredTier: 'monitor', binary: 'wifite', description: 'Automated WiFi attacks; WPS PIN, WPA handshake capture and cracking.', triggers: ['wifite', 'wifi auto', 'automated wifi'], upgradeNote: 'Fully automated attacks require scoped authorization.' },
  { name: 'ettercap', category: 'wireless-network', requiredTier: 'monitor', binary: 'ettercap', description: 'Classic MITM; ARP poisoning and credential sniffing for 30+ protocols.', triggers: ['ettercap', 'arp poison', 'credential sniff'], upgradeNote: 'Active MITM requires explicit approval on scoped targets.' },
  // Forensics - monitor
  { name: 'autopsy', category: 'forensics-imaging', requiredTier: 'monitor', binary: 'autopsy', description: 'Digital forensics platform; case ingest, timeline, and reporting.', triggers: ['autopsy', 'forensic case', 'disk ingest'], upgradeNote: null },
  { name: 'volatility3', category: 'forensics-imaging', requiredTier: 'monitor', binary: 'vol', description: 'Memory forensics; processes, network, registry, and malware artifacts.', triggers: ['volatility', 'memory forensics', 'ram dump'], upgradeNote: null },
  { name: 'dc3dd', category: 'forensics-imaging', requiredTier: 'monitor', binary: 'dc3dd', description: 'Forensically sound disk imaging with integrated hashing.', triggers: ['dc3dd', 'disk image', 'forensic image'], upgradeNote: 'Block device imaging requires explicit approval and write blocker.' },
  { name: 'sleuthkit', category: 'forensics-imaging', requiredTier: 'monitor', binary: 'fls', description: 'File system forensics; partitions, deleted files, inode recovery.', triggers: ['sleuthkit', 'tsk', 'fls', 'mmls'], upgradeNote: null },
  { name: 'binwalk', category: 'forensics-imaging', requiredTier: 'monitor', binary: 'binwalk', description: 'Firmware analysis; extract embedded filesystems and signatures.', triggers: ['binwalk', 'firmware extract'], upgradeNote: null },
  { name: 'ghidra', category: 'forensics-imaging', requiredTier: 'monitor', binary: 'analyzeHeadless', description: 'Headless binary reverse engineering and decompilation.', triggers: ['ghidra', 'reverse engineer', 'decompile'], upgradeNote: null },
  { name: 'bulk-extractor', category: 'forensics-imaging', requiredTier: 'monitor', binary: 'bulk_extractor', description: 'Bulk data extraction; emails, URLs, domains, credit cards from images.', triggers: ['bulk_extractor', 'bulk extract', 'evidence triage'], upgradeNote: null },
  { name: 'yara', category: 'forensics-imaging', requiredTier: 'monitor', binary: 'yara', description: 'YARA malware pattern matching on files and directories.', triggers: ['yara', 'malware scan', 'yara rules'], upgradeNote: null },
  { name: 'guymager', category: 'forensics-imaging', requiredTier: 'monitor', binary: 'guymager', description: 'Forensic imager; DD, E01, AFF formats with hash verification.', triggers: ['guymager', 'e01 image'], upgradeNote: 'Block device imaging requires explicit approval.' },
  { name: 'rekall', category: 'forensics-imaging', requiredTier: 'monitor', binary: 'rekall', description: 'Alternative memory forensics framework with plugin profiles.', triggers: ['rekall', 'memory analysis'], upgradeNote: null },
  { name: 'foremost', category: 'forensics-imaging', requiredTier: 'monitor', binary: 'foremost', description: 'File carving via header/footer signatures.', triggers: ['foremost', 'file carve', 'carving'], upgradeNote: null },
  { name: 'plasmo', category: 'forensics-imaging', requiredTier: 'monitor', binary: 'psteal.py', description: 'Plaso super-timeline generation from disk images.', triggers: ['plaso', 'log2timeline', 'super timeline'], upgradeNote: null },
  { name: 'xplico', category: 'forensics-imaging', requiredTier: 'monitor', binary: 'xplico', description: 'Network forensics; decode HTTP, SMTP, FTP, VoIP from PCAP.', triggers: ['xplico', 'pcap decode', 'network forensics'], upgradeNote: null },
  { name: 'regripper', category: 'forensics-imaging', requiredTier: 'monitor', binary: 'rip', description: 'Windows registry hive analysis for persistence and user activity.', triggers: ['regripper', 'registry forensics', 'rip.pl'], upgradeNote: null },
  { name: 'hashdeep', category: 'forensics-imaging', requiredTier: 'monitor', binary: 'hashdeep', description: 'Hash set generation and verification for evidence integrity.', triggers: ['hashdeep', 'hash audit', 'evidence hash'], upgradeNote: null },
  { name: 'ollydbg', category: 'forensics-imaging', requiredTier: 'monitor', binary: 'wine', description: 'Windows 32-bit debugger via Wine for malware behavior analysis.', triggers: ['ollydbg', 'malware debug'], upgradeNote: 'Executes untrusted binaries; requires explicit approval.' },
  // Traffic - monitor
  { name: 'tshark', category: 'sniffing-traffic', requiredTier: 'monitor', binary: 'tshark', description: 'Wireshark CLI analyzer; 3000+ protocol dissectors for PCAP files.', triggers: ['tshark', 'wireshark', 'pcap analyze', 'protocol decode'], upgradeNote: null },
  { name: 'tcpdump', category: 'sniffing-traffic', requiredTier: 'monitor', binary: 'tcpdump', description: 'Live packet capture with BPF filters to PCAP.', triggers: ['tcpdump', 'packet capture', 'traffic capture'], upgradeNote: 'Live capture requires authorization on the monitored interface.' },
  { name: 'dsniff', category: 'sniffing-traffic', requiredTier: 'monitor', binary: 'dsniff', description: 'Cleartext credential sniffer for HTTP, FTP, Telnet, SMTP, and more.', triggers: ['dsniff', 'credential sniff', 'password sniff'], upgradeNote: 'Credential interception requires explicit approval.' },
  { name: 'responder', category: 'sniffing-traffic', requiredTier: 'monitor', binary: 'responder', description: 'LLMNR/NBT-NS/mDNS poisoner for NTLM hash capture.', triggers: ['responder', 'llmnr poison', 'ntlm capture'], upgradeNote: 'Poisoning mode requires explicit approval; use analyze mode for passive recon.' },
  { name: 'scapy', category: 'sniffing-traffic', requiredTier: 'monitor', binary: 'python3', description: 'Python packet crafting via user-supplied scapy scripts.', triggers: ['scapy', 'packet craft', 'custom packets'], upgradeNote: 'Packet injection requires explicit approval.' },
  // Privacy - monitor
  { name: 'anonsurf', category: 'privacy-opsec', requiredTier: 'monitor', binary: 'anonsurf', description: 'Route all system traffic through Tor with periodic IP rotation.', triggers: ['anonsurf', 'tor route', 'anonymous surf'], upgradeNote: 'Starting Tor routing affects all system traffic; requires approval.' },
  { name: 'tor', category: 'privacy-opsec', requiredTier: 'monitor', binary: 'torify', description: 'Run commands via Tor SOCKS proxy (torify) or verify Tor config.', triggers: ['tor', 'torify', 'socks proxy'], upgradeNote: 'Proxy mode executes commands through Tor; requires approval.' },
  { name: 'mat2', category: 'privacy-opsec', requiredTier: 'monitor', binary: 'mat2', description: 'Strip EXIF and metadata from files before sharing.', triggers: ['mat2', 'metadata strip', 'exif remove'], upgradeNote: null },
  { name: 'bleachbit', category: 'privacy-opsec', requiredTier: 'monitor', binary: 'bleachbit', description: 'Secure cleaning of browser history, caches, logs, and temp files.', triggers: ['bleachbit', 'secure clean', 'anti-forensics clean'], upgradeNote: 'Cleaning permanently removes local artifacts; requires approval.' },
  { name: 'gparted', category: 'privacy-opsec', requiredTier: 'monitor', binary: 'parted', description: 'Disk partitioning via parted for forensic storage volumes.', triggers: ['gparted', 'parted', 'disk partition'], upgradeNote: 'Partitioning destroys all data on the target device.' },
  // Reverse engineering - monitor
  { name: 'radare2', category: 'reverse-engineering', requiredTier: 'monitor', binary: 'r2', description: 'Radare2 binary triage; disassembly, functions, strings, exports.', triggers: ['radare2', 'r2', 'binary triage'], upgradeNote: null },
  { name: 'cutter', category: 'reverse-engineering', requiredTier: 'monitor', binary: 'cutter', description: 'Cutter headless RE; script-driven analysis and export.', triggers: ['cutter', 're gui', 'radare2 gui'], upgradeNote: null },
  { name: 'vscodium', category: 'reverse-engineering', requiredTier: 'monitor', binary: 'codium', description: 'Open files in VSCodium for exploit dev and forensic scripting.', triggers: ['vscodium', 'codium', 'code editor'], upgradeNote: null },
  // Blue team - monitor
  { name: 'snort', category: 'blue-team-defense', requiredTier: 'monitor', binary: 'snort', description: 'IDS/IPS network monitoring with Snort rule sets.', triggers: ['snort', 'ids', 'ips', 'intrusion detection'], upgradeNote: null },
  { name: 'bloodhound', category: 'blue-team-defense', requiredTier: 'monitor', binary: 'bloodhound-python', description: 'Active Directory attack path mapping and collection.', triggers: ['bloodhound', 'ad map', 'attack path', 'domain admin path'], upgradeNote: 'AD enumeration is detectable; requires scoped authorization.' },
  // Reporting - monitor
  { name: 'log2timeline', category: 'reporting-tip', requiredTier: 'monitor', binary: 'log2timeline.py', description: 'Plaso super-timeline creation from disk images.', triggers: ['log2timeline', 'super timeline', 'plaso timeline'], upgradeNote: null },
  { name: 'timesketch', category: 'reporting-tip', requiredTier: 'monitor', binary: 'timesketch', description: 'Collaborative forensic timeline search via Timesketch REST API.', triggers: ['timesketch', 'timeline search', 'forensic search'], upgradeNote: 'Requires Timesketch server. Set TIMESKETCH_URL and TIMESKETCH_API_KEY.' },
  { name: 'stix', category: 'reporting-tip', requiredTier: 'monitor', binary: 'python3', description: 'Export findings as STIX 2.1 bundles for threat intelligence sharing.', triggers: ['stix', 'threat intel export', 'tip export'], upgradeNote: null },
  { name: 'cyberchef', category: 'reporting-tip', requiredTier: 'monitor', binary: 'cyberchef', description: 'Programmatic CyberChef data transformation recipes.', triggers: ['cyberchef', 'data transform', 'recipe bake'], upgradeNote: 'Requires CyberChef server. Set CYBERCHEF_URL (default http://127.0.0.1:3000).' },
];
```

---

## Acceptance criteria

- [ ] `/security/tools` is reachable from the sidebar under the account group
- [ ] Page loads in stub mode (no core configured) and shows all 72 tools with "Unknown" health
- [ ] Page loads in connected mode and shows installed/missing health per tool
- [ ] Search filters tools by name and trigger phrase (case-insensitive)
- [ ] Category chips filter to the selected category; "All categories" resets the filter
- [ ] Tier chips filter by `requiredTier`; "All tiers" resets
- [ ] "Show locked" toggle hides/shows tools above the current tier
- [ ] Lock icon appears on tools above the current tier; those rows are dimmed to `opacity-50`
- [ ] Tier badge color matches the spec above
- [ ] Each trigger chip copies the phrase to clipboard on click and shows "Copied" tooltip
- [ ] Health column shows green/red/grey dot with label
- [ ] Stub mode banner appears when source is `'stub'`
- [ ] Health loads independently and updates the column without re-fetching the tool list
- [ ] No em dashes, no en dashes, no emojis in any string or label
- [ ] TypeScript compiles cleanly with no new type errors
- [ ] Page renders without layout breaks at 375px, 768px, 1280px

## Do not touch

- `src/tools/cyber-tools-registry.ts` (in the Carina backend repo) - already provided via API
- Any existing security page files (`/security/page.tsx`, `SecurityDashboardClient.tsx`)
- Any billing, analytics, or channel pages
- The `packages/web/src/web-server.ts` (that was done in Part A)
