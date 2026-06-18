# What Is Carina; The Vision, Fully Realized

**Status:** Visionary (all 8 gaps closed)  
**Date:** 2026-06-18  
**Previous versions:** what_is_carina1-3.mp3 (voice descriptions, partial coverage)

---

## The One-Sentence Answer

Carina is the first autonomous AI agent platform that combines a gold-standard operator experience, 72 built-in cyber tools, a standalone SaaS security companion (Scout), cross-agent skill consumption, and enterprise-grade security; deployable in 15 minutes.

---

## The Architecture

Carina runs as a multi-service container under s6-overlay supervision. Four services start in priority order inside a single Docker container:

```
Carina Core (priority 10) → The agent brain. Port 3333.
Carina Gateway (priority 20) → All channel connections. Port 4001.
Carina Web (priority 30) → Web dashboard. Port 8080.
Carina Cron (priority 20) → Recurring autonomous tasks.
```

One command deploys everything: `carina deploy`. The container starts, Postgres and Redis come up, the gateway connects to Telegram, Discord, Slack, and WhatsApp, and Carina is online. Health checks run every 30 seconds. If any service crashes, s6 restarts it. Logs rotate automatically. Zero manual supervision.

---

## The Five Surfaces

### CLI; 150+ Commands
`carina` with no arguments drops into an interactive REPL with fuzzy autocomplete, rich formatting, and a dark-themed banner. `carina <command>` hits the command tree: `carina hub install`, `carina scout scan`, `carina memory search`, `carina doctor`. Shell completions for bash, zsh, and fish. `carina setup` runs a 20-question interactive wizard that configures the entire platform in under 5 minutes. It detects your OS, offers to import from Hermes, OpenClaw, or Odysseus, installs dependencies, creates your first workspace, and shows you the dashboard. 15 minutes from install to first recon scan.

### TUI; Ink Chat, Gold Standard
`carina tui` opens a full Ink/React chat TUI with streaming responses rendered character by character. Markdown with syntax-highlighted code blocks. Thinking blocks collapse and expand on keypress. Tool calls appear as expandable cards with status indicators; green spinner while running, green checkmark on success, red X on failure. Ctrl+M opens the model picker overlay. Ctrl+S opens the session switcher with fuzzy search. The status bar shows live token count, model name, and connection health. `carina tui --operator` opens the readline-based operator dashboard for power users who need a live view of running sessions, Scout status, logs, and memory.

### Desktop; Tauri, Native
The Tauri desktop app runs on Windows, macOS, and Linux. It has a full chat composer with slash-command autocomplete, @-mention autocomplete, voice recording, file drag-and-drop, and attachment preview. The session panel shows all sessions with search and switching. The model picker groups models by provider with cost indicators. The Scout widget shows trust scores and security events in real time. Canvas windows open for agent-generated HTML, SVG, and code artifacts. The system tray shows connection status. Native notifications fire on agent completion. Launch at login. Global shortcut to activate. Companion pairing via QR code links the mobile app in seconds.

### Mobile; Native Sensors
The React Native app has 121 files covering chat, memory, billing, and Scout integration. But the native depth layer is what makes it special. Background WebSocket connection keeps the agent alive even when the app is backgrounded. Camera access lets the agent request photos or continuous frame streams for vision analysis. Location services provide geofencing and battery-aware GPS tracking. Motion sensors detect walking, running, and driving. The notification relay streams device notifications to the agent for context awareness. SMS and call log access on Android. Contacts and calendar integration. Secure enclave storage for API keys with biometric protection. Companion pairing via Bonjour/mDNS discovers nearby Carina servers on LAN and pairs with a QR scan. The operator conducts a wireless site survey from their phone; Carina accesses the Wi-Fi chipset directly, runs a passive scan via Kismet, detects rogue access points, geotags each one, and uploads the survey to the investigation case file. No laptop needed.

### Web Dashboard
`app.carinaai.uk` is a full single-page application. Three-zone shell: sidebar navigation, main content area, and detail panel. The chat interface has ThinkingBlock, ToolCallBlock, and StreamingMessage components rendered in real time. The PTY bridge embeds a fully rendered terminal (xterm.js) inside the browser with streaming output, syntax highlighting, and clickable file paths. The operator can open multiple terminal tabs connected to different Carina sessions. Drag and drop files from desktop into the terminal to attach evidence. The canvas viewer renders agent-generated HTML, SVG, and code artifacts. Admin pages cover workspace management, user management, audit logs, system health, billing overview, and Scout dashboard. The CommandPalette (Cmd+K) provides instant navigation. Keyboard shortcuts throughout. PWA install for offline access. Twelve languages with full RTL support; the operator in Tokyo sees the same interface as the operator in London, in their native language with culturally appropriate date formats.

---

## Scout; The Security Companion

Scout is a standalone SaaS security product at `labyrinthscout.com`. It runs 25 automated tools continuously:

- **Reconnaissance:** Amass, Recon-ng, SpiderFoot, theHarvester, Shodan, Censys
- **Vulnerability Scanning:** Nuclei, OpenVAS, Nikto, Wapiti
- **Fuzzing:** ffuf, wfuzz, dirb
- **Intrusion Detection:** Snort, Suricata, Zeek
- **Reporting:** Automated reports with executive summaries and technical appendices

Scout has its own checkout, billing, branding, authentication, and database. It is a separate product. Carina consumes Scout as a customer via API; one command: `carina scout connect`.

Carina's operator terminal gets access to all 72 cyber tools including exploitation (Metasploit, Impacket, Hydra, John, Hashcat), forensics (Volatility, Autopsy, Bulk Extractor, dc3dd, Guymager), wireless (Aircrack-ng, Kismet, Wifite, Bettercap), reverse engineering (Ghidra, Radare2, objdump, strings), and traffic analysis (Wireshark/TShark, tcpdump). Scout finds the problems autonomously. Carina exploits, validates, and remediates on command.

Every investigation auto-generates a structured Obsidian vault; linked notes with chain of custody, timeline views, evidence cross-references, and exportable reports. The operator closes a case and their Obsidian vault updates with everything they need for the board presentation.

### Scout Pricing

| Tier | Price | What You Get |
|---|---|---|
| Self-Hosted Carina | £0 | Carina on your infrastructure. No Scout. No security power. |
| Cloud Carina | £20/mo | Carina on our infrastructure + metered tokens. No Scout. |
| Carina + Scout Monitor | £49/mo | Continuous security monitoring. Alerts. Basic reports. |
| Carina + Scout Govern | £79/mo | Full governance. Compliance reporting. Audit trails. SOC2 evidence. |
| Enterprise | Quote | SSO, data residency, SLA, dedicated infrastructure. |

---

## CarinaHub; The Public Skill Marketplace

`hub.carinaai.uk` is not a simple directory. It has reviews, ratings, download counts, verified publisher badges, security scanning, and dependency resolution. Every submitted skill runs through a security scanner in a sandboxed environment before publication. The scanner checks for exfiltration patterns, shell injection, hardcoded credentials, prompt injection, and file operations outside the workspace. Clean skills get a "Verified by Carina" community badge. Flagged skills enter a human review queue.

The marketplace has five pages: homepage with featured skills and stats, browse with category filters and sorting, skill detail with install count and reviews, publish form with inline validation, and author profiles. The CLI has full marketplace commands: `carina hub search`, `carina hub install`, `carina hub publish`, `carina hub update`, `carina hub uninstall`. One command installs a community skill. One command publishes your own.

## Cross-Agent Skill Consumption

Carina is a meta-platform. It natively runs skill packs from Hermes, OpenClaw, and Odysseus public hubs. If someone publishes a skill for any of those agents, Carina consumes it. The adapters translate each agent's skill format into Carina's execution model at runtime. Tool calls are mapped. File permissions are scoped. The operator types `carina hub install --from openclaw-hub security-scanner` and 30 seconds later they're running an OpenClaw skill inside Carina.

This means Carina's skill ecosystem is not limited to what the Carina community builds. It inherits the entire skill ecosystem of every major agent platform. The network effect compounds.

---

## Enterprise Security; SOC2, SSO, Zero Trust

Carina is built for organizations that cannot compromise on security.

**Single Sign-On:** SAML, OIDC, and LDAP. Okta, Azure AD, Google Workspace, Keycloak. Role-based access control with custom roles. Just-in-time provisioning. Session timeouts and forced re-authentication for sensitive operations.

**Immutable Audit:** Every agent action is logged to a Merkle tree. The tree root is anchored to a public blockchain periodically. Logs are stored on WORM (Write Once, Read Many) storage. Tampering is cryptographically detectable. Auditors receive a verifiable proof package; not a CSV they have to trust.

**Data Residency:** Region-locked storage buckets. Geo-fenced API endpoints. GDPR compliance with data subject access request automation. Right to erasure with cryptographic proof of deletion. The operator in Frankfurt knows their data never leaves EU-West-1. The operator in Tokyo knows their data stays in APAC.

**Disaster Recovery:** Cross-region failover. 5-minute Recovery Point Objective. 15-minute Recovery Time Objective. Automated quarterly DR testing with audit reports. The operator runs `carina dr test` and 15 minutes later they have a full DR test report showing successful failover and failback.

**Zero-Trust Networking:** Mutual TLS between all services. SPIFFE identities for every process. Cilium network policies that default-deny all traffic and whitelist only what's needed. No service trusts any other service by default. The gateway cannot talk to the database. The web server cannot talk to the cron scheduler. Every connection is authenticated and authorized.

**SOC2 Type II:** Continuous evidence collection across 14 controls. Automated auditor package export. Control mapping to SOC2 Trust Services Criteria. The compliance officer logs into the admin panel and clicks "Export SOC2 Evidence Package." A zip file downloads with all 14 controls mapped, evidence attached, and a summary report. Auditor-ready.

---

## Migration; Hermes, OpenClaw, Odysseus Users Welcome

Carina has six strategies to attract users from competing platforms:

1. **Import Tools:** `carina import hermes` reads a Hermes config, skills, memory, and cron jobs and converts them to Carina format in under 30 seconds. Same for OpenClaw and Odysseus.

2. **Free Scout Funnel:** Import your config from another agent, connect Scout for free for 30 days. Scout finds security issues. You stay for the security.

3. **Community Skill Bridge:** A community-maintained adapter that keeps Hermes, OpenClaw, and Carina skills synchronized across platforms. Teams don't have to choose one agent.

4. **CISO Enterprise Pitch:** A 30-page deck showing how Carina + Scout reduces security tool sprawl from 12 tools to 1 platform.

5. **Cross-Agent Skill Consumption:** Carina runs their skills. They don't have to leave their ecosystem behind.

6. **Performance Benchmarking:** Public benchmarks updated monthly showing Carina outperforming competitors on tool call speed, context utilization, and security scan depth.

---

## The 72 Cyber Tools

Carina's operator terminal has access to 72 security tools across seven categories:

- **Reconnaissance (8):** Amass, Recon-ng, SpiderFoot, theHarvester, Shodan, Censys, Masscan, Nmap
- **Vulnerability Scanning (6):** Nuclei, OpenVAS, Nikto, Wapiti, SQLMap, Burp Suite
- **Exploitation (12):** Metasploit, Impacket, Hydra, John the Ripper, Hashcat, Evil-WinRM, CrackMapExec, Responder, Mimikatz, PowerSploit, Empire, Covenant
- **Forensics (10):** Volatility, Autopsy, Bulk Extractor, dc3dd, Guymager, Foremost, Scalpel, Binwalk, ExifTool, Ghidra
- **Wireless (6):** Aircrack-ng, Kismet, Wifite, Bettercap, Reaver, HCXDumpTool
- **Traffic Analysis (5):** Wireshark/TShark, tcpdump, Zeek, Suricata, Snort
- **Reverse Engineering (5):** Ghidra, Radare2, objdump, strings, ltrace/strace
- **OSINT (8):** Maltego, Holehe, Sherlock, PhoneInfoga, EmailRep, Have I Been Pwned API, Wayback Machine, Google Dorking
- **Reporting & Compliance (6):** Scout Reporter, Compliance Mapper, Evidence Packager, Chain of Custody Logger, Obsidian Vault Generator, SOC2 Evidence Exporter
- **Utility (6):** netcat, socat, curl/wget, OpenSSL, GPG, ssh-audit

Every tool has a dedicated prompt file specifying exact commands, expected outputs, error handling, and integration with Carina's operator terminal.

---

## The Onboarding Experience

First run: `carina setup`.

A dark-themed welcome screen with deep indigos and amber accents. Monospace fonts. It asks your name. It detects your operating system. It offers to import from Hermes, OpenClaw, or Odysseus if it finds them. It asks if you want security tooling. It installs dependencies; Python, Node, Docker, system packages. It creates your first workspace. It connects to Scout if you have an account. It shows you the dashboard. 15 minutes from install to first recon scan.

The onboarding wizard is warm, guided, and thorough. It does not assume you know what an agent is. It explains each choice. It shows examples. It has a "skip and explore later" option for every section. The user who just heard about AI agents yesterday and the operator who has been running Hermes for a year both finish onboarding feeling confident.

---

## What Makes Carina the Gold Standard

Carina is not the first AI agent platform. It is the one that gets everything right.

**Hermes' soul**; the conversational depth, memory persistence, and session management that make Hermes feel like a collaborator, not a tool.

**OpenClaw's bones**; the native sensor integration, background services, and device-level access that make OpenClaw feel like it lives in your pocket.

**Odysseus' skin**; the dark-themed UI, keyboard-first navigation, entity anchors, and window system that make Odysseus feel like a professional workspace.

**Carina's brain**; the 72 cyber tools, Scout companion, cross-agent skill consumption, enterprise security, and competitive migration that make Carina feel like the platform you bet your company on.

One command deploys it. One command imports your old agent. One command starts a security audit. One command generates an auditor-ready compliance package.

Carina is the agent you give to your security team. The agent you give to your compliance officer. The agent you give to your developers. The agent you give to your CEO for the board presentation. One platform. Every surface. Any provider. Complete security.

That's Carina.
