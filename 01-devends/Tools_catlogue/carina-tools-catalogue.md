# Carina Tools Catalogue

Snapshot date: 2026-06-26

This catalogue documents the named tools available in the Carina core agent source. It is written for product, engineering, operations, and investor conversations: what the tools do, why they exist, and how a user or agent normally triggers them.

## Executive Summary

Carina is not just a security assistant with 77 cyber tools. The current source exposes 233 named tools when combining default registered tools, toolset-addressable tools, and explicitly registered tools outside the named toolset map.

The tool estate breaks down into these major capability layers:

| Layer | Count | Purpose |
|---|---:|---|
| Security | 77 | Recon, vulnerability scanning, exploitation, web testing, wireless, forensics, traffic, privacy, reverse engineering, blue team, reporting |
| Utilities | 24 | JSON, hashes, UUIDs, time, URL parsing, RSS, cron, YAML, colors, disk, Git, encoding |
| Content | 17 | Incident blog workflow, approvals, publishing, newsletter, source search |
| Integrations | 17 | Home Assistant, X/Twitter, Discord, Feishu/Lark, Yuanbao, platform integrations |
| Research | 16 | PSPP, Jamovi, R, SPSS/SAV/SPV, statistics, APA formatting |
| Browser | 12 | Playwright browser control, screenshots, DOM snapshots, console, CDP, dialogs |
| Orchestration | 12 | Todo, Kanban, delegation, scheduled jobs |
| Node device | 10 | Connected device canvas, camera, GPS, screen recording |
| Media | 9 | Vision, video, transcription, TTS, image and video generation, Spotify |
| Messaging | 6 | Send messages, email, SMTP, inbound mail, webhooks, PDF generation |
| Ops | 5 | Secret audit, capability audit, channel health, learning status, debug helpers |
| Skills | 4 | List, view, manage, and curate skills |
| Workspace | 3 | Notes, documents, image gallery |
| Terminal | 2 | Shell execution and background process management |
| Web | 2 | Live web search and HTTPS requests |
| Search | 2 | Web search and session history search |
| Sync | 2 | Agent sync and contacts |
| Debug | 2 | Debug helpers and LSP |
| Checkpoint | 1 | Create and restore checkpoints |
| MCP | 1 | Connect and call Model Context Protocol servers |
| Ensemble | 1 | Mixture of agents |
| Core file and direct tools | 10 | File read, file write, patch, memory, code execution, phone control, computer use, n8n, Trello, theme |

## How Tools Are Triggered

Carina tools are normally triggered by intent, not by a visible button. The model selects a tool when the user asks for work that matches the tool name, description, parameter schema, or cyber trigger phrases.

Common trigger patterns:

| Trigger style | Example user request | Likely tool |
|---|---|---|
| Exact tool name | "Use `web-search` to check this" | `web-search` |
| Natural language | "Search the repo for every Stripe reference" | `search-files` |
| Operational verb | "Read this file" | `file-read` |
| Outcome request | "Make this edit" | `patch` or `file-write` |
| Workflow request | "Create a Kanban card for this bug" | `kanban-create` |
| Channel request | "Email this summary to Malik" | `email-send` or `send-message` |
| Toolset request | "Use the research tools on this SAV file" | research toolset |
| Cyber trigger phrase | "Scan ports on this host" | `nmap` |

Toolsets can also be used as routing hints. The names are defined in `src/tools/toolset.ts`: `terminal`, `security`, `web`, `browser`, `search`, `skills`, `sync`, `messaging`, `media`, `mcp`, `orchestration`, `debug`, `checkpoint`, `integrations`, `ensemble`, `workspace`, `content`, `research`, `ops`, `utilities`, and `node`.

Risk classes from `src/tools/tool-risk-registry.ts`:

| Risk | Meaning |
|---|---|
| `read` | Reads local state, remote state, or metadata |
| `write` | Mutates files, app state, channels, documents, or external systems |
| `execute` | Runs host binaries, code, shell commands, or analysis engines |
| `external` | Calls external services or remote APIs |
| `credential` | May touch credentials, secrets, or platform tokens |

## Core Agent Tools

| Tool | Used for | How to trigger |
|---|---|---|
| `file-read` | Read local files with line numbers, offset, and limit. | "Read `path`", "open this file", "show me lines..." |
| `file-write` | Create or overwrite a file with syntax checks for common formats. | "Write this file", "create a new file..." |
| `patch` | Find and replace text in an existing file with a returned diff. | "Change this block", "replace X with Y in..." |
| `search-files` | Search file names or file contents with regex and glob filters. | "Find every reference to...", "search the repo for..." |
| `shell-exec` | Run shell commands, optionally in the background. | "Run tests", "start the server", "execute..." |
| `process` | List, poll, wait, kill, or write to background shell sessions. | "Check that background process", "stop session..." |
| `code-exec` | Run sandboxed code snippets in supported languages. | "Run this snippet", "test this code quickly" |
| `memory` | Read or write agent memory. | "Remember this", "what do you remember about..." |
| `session-search` | Search prior session history. | "Find where we discussed...", "search this conversation history" |
| `phone-control` | Run actions on a connected phone node, including shell actions. | "Use the phone node", "run this on the phone" |
| `computer-use` | Navigate, click, type, screenshot, or interact with a GUI/browser style computer session. | "Use the computer", "click this", "navigate to..." |
| `checkpoint-manager` | Create, list, restore, and manage work checkpoints. | "Create a checkpoint", "restore checkpoint..." |
| `debug-helpers` | Inspect debug metadata and helper diagnostics. | "Debug tool state", "show helper diagnostics" |
| `lsp` | Language Server Protocol based code intelligence. | "Find symbol", "go to definition", "diagnose this file" |

## Web And Search

| Tool | Used for | How to trigger |
|---|---|---|
| `web-search` | Live search through configured providers such as SearXNG, Tavily, or Brave. | "Search the web", "look up current..." |
| `http-request` | Make an HTTPS request to an external API with safety checks. | "Call this API", "GET this endpoint" |
| `x-search` | Search X/Twitter, with API fallback behavior. | "Search X for..." |
| `rss-fetch` | Fetch and parse RSS or Atom feeds. | "Read this RSS feed" |

## Browser Tools

Browser tools are registered when Playwright is available.

| Tool | Used for | How to trigger |
|---|---|---|
| `browser-navigate` | Open a URL in a browser session. | "Open this page", "go to..." |
| `browser-click` | Click a page element. | "Click the login button" |
| `browser-type` | Type into a field. | "Type this into..." |
| `browser-press` | Send keyboard keys. | "Press Enter", "press Escape" |
| `browser-scroll` | Scroll the page. | "Scroll down" |
| `browser-snapshot` | Get a DOM/accessibility snapshot. | "Inspect the page" |
| `browser-console` | Read browser console logs. | "Check console errors" |
| `browser-back` | Navigate back. | "Go back" |
| `browser-get-images` | Extract page image references. | "Get images from this page" |
| `browser-vision` | Inspect page screenshots visually. | "Look at the page" |
| `browser-cdp` | Run Chrome DevTools Protocol operations. | "Use CDP to..." |
| `browser-dialog` | Handle alert, confirm, or prompt dialogs. | "Accept the dialog" |

## Orchestration And Work Management

| Tool | Used for | How to trigger |
|---|---|---|
| `todo` | Read or update the session todo list. | "Track these steps", "update the todo list" |
| `clarify` | Ask for missing user input. | "Ask a clarifying question" |
| `delegate-task` | Delegate work to a subagent with selected toolsets. | "Delegate this", "spawn a worker" |
| `cronjob` | Schedule recurring agent jobs. | "Run this every day", "schedule..." |
| `kanban` | General Kanban board operations. | "Manage the board" |
| `kanban-show` | Show the full board by column. | "Show the Kanban board" |
| `kanban-list` | List cards, optionally by column. | "List in-progress cards" |
| `kanban-create` | Create a card. | "Create a card for..." |
| `kanban-complete` | Mark a card done. | "Complete card..." |
| `kanban-block` | Block a card with a reason. | "Block this card because..." |
| `kanban-unblock` | Remove a block. | "Unblock card..." |
| `kanban-link` | Link two cards. | "Link these cards" |
| `kanban-comment` | Add a comment. | "Comment on card..." |
| `kanban-heartbeat` | Board health check for blocked or stale work. | "Check board health" |

## Messaging And Documents

| Tool | Used for | How to trigger |
|---|---|---|
| `send-message` | Send outbound messages through supported channels. | "Message Malik...", "send this to..." |
| `email-send` | Send outbound email. | "Email this..." |
| `email-smtp-send` | Send email through an SMTP relay. | "Send via SMTP..." |
| `email-list` | Read stored inbound mail. | "List emails", "check inbox" |
| `webhook` | Register, list, trigger, or inspect webhook deliveries. | "Create a webhook", "trigger webhook..." |
| `generate-pdf` | Convert markdown or HTML into a PDF. | "Make a PDF", "export this as PDF" |

## Media Tools

| Tool | Used for | How to trigger |
|---|---|---|
| `vision-analyze` | Analyze image files with a vision model. | "Describe this image", "inspect this screenshot" |
| `video-analyze` | Analyze videos by model or sampled frames. | "Analyze this video" |
| `transcription` | Transcribe audio. | "Transcribe this audio" |
| `text-to-speech` | Convert text to speech. | "Read this aloud", "make audio" |
| `image-generation` | Generate images from prompts. | "Generate an image..." |
| `video-generation` | Generate videos from prompts. | "Generate a video..." |
| `spotify-search` | Search Spotify. | "Search Spotify for..." |
| `spotify-now-playing` | Read current Spotify playback state. | "What is playing?" |
| `spotify-play` | Control Spotify playback. | "Play this track", "pause Spotify" |

## Skills, Memory, And Knowledge

| Tool | Used for | How to trigger |
|---|---|---|
| `skills-list` | List installed skills. | "List skills" |
| `skill-view` | View a skill by name. | "Show the X skill" |
| `skill-manage` | Create, update, delete, enable, or disable skills. | "Create a skill", "disable this skill" |
| `skill-curator` | Curate and mutate skills from usage patterns. | "Curate skills", "improve the skill pack" |
| `contacts` | Resolve contacts from Carina contact stores. | "Find Malik's contact", "send this to..." |
| `agent-sync` | Sync state between agents or instances. | "Sync agent state" |
| `mcp` | Connect, list, and call tools from MCP servers. | "Use this MCP server", "call MCP tool..." |
| `mixture-of-agents` | Ask multiple agents/models and merge responses. | "Use a panel of agents", "compare model answers" |

## Workspace Tools

| Tool | Used for | How to trigger |
|---|---|---|
| `notes-manage` | Manage workspace notes. | "Create a note", "search notes" |
| `documents-manage` | Manage workspace documents. | "Store this document", "find documents" |
| `images-gallery` | Manage generated or stored image metadata. | "Show gallery", "delete this gallery image" |
| `theme` | Read or set theme colors. | "Set the theme", "change accent color" |

## Integrations

| Tool | Used for | How to trigger |
|---|---|---|
| `homeassistant` | Control Home Assistant through REST. | "Turn on the light", "check Home Assistant" |
| `ha-list-entities` | List entity states. | "List Home Assistant entities" |
| `ha-get-state` | Get one entity state. | "Get state of light.kitchen" |
| `ha-list-services` | List available Home Assistant services. | "List HA services" |
| `ha-call-service` | Call a Home Assistant service. | "Call light.turn_on" |
| `discord` | Send messages to Discord channels. | "Post to Discord" |
| `discord-admin` | List channels, members, roles, pin messages, and manage threads. | "Create a Discord thread", "pin this message" |
| `feishu-doc` | Read Feishu/Lark documents. | "Read this Feishu doc" |
| `feishu-drive` | List Feishu/Lark drive files. | "List Feishu drive files" |
| `feishu-chat-send` | Send Feishu chat messages. | "Send this to Feishu" |
| `feishu-user-lookup` | Look up Feishu users. | "Find this Feishu user" |
| `yuanbao` | Ask Tencent Yuanbao/Hunyuan. | "Ask Yuanbao..." |
| `yb-chat` | Chat with Yuanbao/Hunyuan API. | "Use yb-chat..." |
| `yb-search` | Search Yuanbao/Hunyuan knowledge or web fallback. | "Search Yuanbao for..." |
| `x-post` | Post to X/Twitter. | "Tweet this..." |
| `platform-integrate` | Platform integration and optional credential access. | "Integrate this platform" |
| `n8n` | Interact with n8n workflows. | "Use n8n", "trigger workflow..." |
| `trello` | Interact with Trello boards and cards. | "Create a Trello card" |

## Content And Publishing

| Tool | Used for | How to trigger |
|---|---|---|
| `blog-create` | Create an incident blog draft. | "Create an incident draft" |
| `blog-list` | List incident entries. | "List blog incidents" |
| `blog-show` | Show one incident by id or slug. | "Show incident..." |
| `blog-edit` | Edit an incident draft. | "Edit this incident" |
| `blog-delete` | Delete an incident entry. | "Delete this incident" |
| `blog-approve` | Approve a draft. | "Approve this incident" |
| `blog-publish` | Publish an incident. | "Publish this incident" |
| `blog-reject` | Reject a draft with a reason. | "Reject this draft" |
| `blog-review` | Review draft incidents. | "Review incident drafts" |
| `blog-subscriber-list` | List subscribers. | "List subscribers" |
| `blog-subscriber-stats` | Show subscriber counts. | "Show subscriber stats" |
| `blog-research-run` | Run incident research discovery. | "Research incidents" |
| `blog-research-status` | Show latest research status. | "Check research status" |
| `blog-research-log` | List research run history. | "Show research log" |
| `blog-generate-page` | Regenerate the public incidents page. | "Generate incident page" |
| `blog-newsletter-send` | Send newsletter emails. | "Send the newsletter" |
| `blog-search-source` | Search for source material. | "Search sources for..." |

## Research And Statistics

| Tool | Used for | How to trigger |
|---|---|---|
| `pspp_analyze` | Run PSPP statistical analysis. | "Analyze this dataset with PSPP" |
| `jamovi_analyze` | Run Jamovi or jmv statistical analysis. | "Analyze with Jamovi" |
| `r_analyze` | Run R scripts for statistical analysis. | "Run R analysis" |
| `sav_read` | Read SPSS `.sav` files. | "Read this SAV file" |
| `sav_write` | Write SPSS `.sav` files. | "Save this as SAV" |
| `spv_read` | Read SPSS `.spv` output files. | "Read this SPV output" |
| `spss_syntax_generate` | Generate SPSS/PSPP syntax files. | "Generate SPSS syntax" |
| `spss_output_parse` | Parse SPSS/PSPP output. | "Parse this SPSS output" |
| `stats_describe` | Descriptive statistics. | "Describe this data" |
| `stats_compare_groups` | Group comparison tests. | "Compare these groups" |
| `stats_correlation` | Correlation analysis. | "Run correlations" |
| `stats_regression` | Linear or logistic regression. | "Run regression" |
| `stats_chi_square` | Chi-square tests. | "Run chi-square" |
| `stats_normality` | Normality tests. | "Check normality" |
| `stats_posthoc` | Tukey post-hoc tests. | "Run posthoc tests" |
| `apa_format` | Format statistical results as APA markdown. | "Format this in APA" |

## Operator And Utility Tools

| Tool | Used for | How to trigger |
|---|---|---|
| `secrets-audit` | Scan env and config for secret hygiene without returning secret values. | "Audit secrets" |
| `capabilities-audit` | Compare tools, skills, and channels against operator targets. | "Audit capabilities" |
| `channel-status-snapshot` | Summarize channel adapter health. | "Check channels", "Telegram status" |
| `learning-status` | Read self-improvement loop metrics. | "Show learning status" |
| `json-format` | Parse, validate, pretty print, or minify JSON. | "Format this JSON" |
| `text-hash` | Compute SHA-256, SHA-1, or MD5. | "Hash this text" |
| `uuid-generate` | Generate UUID v4 values. | "Generate UUIDs" |
| `timestamp-convert` | Convert epoch and ISO timestamps. | "Convert this timestamp" |
| `base64-codec` | Encode or decode base64. | "Base64 decode this" |
| `url-parse` | Parse or build URLs. | "Parse this URL" |
| `markdown-to-text` | Strip markdown to plain text. | "Convert markdown to text" |
| `text-diff` | Diff two text blobs. | "Diff these texts" |
| `random-string` | Generate random strings or tokens. | "Generate a random string" |
| `unit-convert` | Convert bytes, temperature, or distance. | "Convert 10 miles to km" |
| `semver-compare` | Compare semantic versions. | "Compare these versions" |
| `regex-test` | Test a regex against sample text. | "Test this regex" |
| `slugify-text` | Create URL-safe slugs. | "Slugify this title" |
| `csv-parse` | Parse simple CSV text. | "Parse this CSV" |
| `ip-parse` | Validate and classify IP addresses. | "Parse this IP" |
| `env-presence` | Check whether env keys are set without exposing values. | "Check env presence" |
| `cron-explain` | Validate cron and show next runs. | "Explain this cron" |
| `research-list` | List saved deep research reports. | "List research reports" |
| `yaml-json-convert` | Convert YAML to JSON or JSON to YAML. | "Convert this YAML to JSON" |
| `color-convert` | Convert hex colors to RGB and back. | "Convert this color" |
| `git-brief-status` | Summarize Git status. | "Check git status" |
| `disk-usage` | Report disk usage. | "Check disk usage" |
| `hex-encode` | Encode or decode hex. | "Hex decode this" |

## Node Device Tools

These tools require the Carina node host routes and a connected device.

| Tool | Used for | How to trigger |
|---|---|---|
| `node_canvas_render` | Render A2UI JSON on a connected node device canvas. | "Render this on device canvas" |
| `canvas_push` | Push HTML, SVG, markdown, image, React, or table artifacts to canvas. | "Push this to canvas" |
| `node_camera_capture` | Capture a photo from a connected node camera. | "Capture photo from node" |
| `camera_capture` | Take a photo using a connected device camera. | "Take a device photo" |
| `node_location_get` | Get current node location. | "Get node location" |
| `location_get` | Get current GPS location. | "Get device GPS" |
| `location_watch` | Start GPS location watch. | "Watch location changes" |
| `location_watch_stop` | Stop a GPS watch. | "Stop location watch" |
| `node_screen_record` | Start or stop node screen recording. | "Record node screen" |
| `screen_record` | Start, stop, or inspect screen recording status. | "Record device screen" |

## Security Tool Catalogue

The security toolset contains 77 named tools. These are grouped by operational phase. Most are high-risk and require authorized scope, confirmation, and the underlying binary or API credentials.

### Reconnaissance And Utility

| Tool | Used for | Trigger phrases |
|---|---|---|
| `nmap` | Network discovery, ports, services, OS, and vulnerability scripts. | scan ports, port scan, nmap |
| `amass` | Passive and active subdomain enumeration. | find subdomains, amass |
| `theHarvester` | Email, subdomain, and name harvesting. | find emails, osint harvest |
| `recon-ng` | Modular OSINT framework workflows. | recon-ng, recon framework |
| `spiderfoot` | Automated OSINT across many modules. | spiderfoot, automated osint |
| `sherlock` | Username search across websites. | username search, sherlock |
| `maltego` | Graph OSINT and relationship mapping. | maltego, graph osint |
| `dmitry` | WHOIS, subdomain, email, port, and banner gathering. | dmitry, whois scan |
| `metagoofil` | Public document metadata extraction. | metagoofil, document metadata |
| `cewl` | Website spidering for custom wordlists. | cewl, wordlist |
| `shodan` | Internet-connected device search through Shodan. | shodan search |
| `censys` | Internet asset discovery through Censys. | censys search |
| `masscan` | Fast port scanning for large ranges. | mass scan, masscan |
| `curl` | Fetch URLs and test endpoints. | curl, fetch url |
| `netcat` | TCP connection tests and banner grabbing. | netcat, nc |

### Vulnerability Scanning

| Tool | Used for | Trigger phrases |
|---|---|---|
| `nuclei` | Template-based CVE, exposure, secret, and misconfiguration scanning. | nuclei scan, vuln scan |
| `nikto` | Web server dangerous file, version, and misconfiguration scanning. | nikto, web server scan |
| `sqlmap` | SQL injection detection and exploitation. | sqlmap, sqli |
| `wpscan` | WordPress plugin, theme, user, and vulnerability scanning. | wpscan, wordpress scan |
| `whatweb` | Web technology fingerprinting. | whatweb, tech fingerprint |
| `yersinia` | Layer 2 protocol testing. | yersinia, layer2 |
| `legion` | Automated network assessment. | legion, network assess |

### Exploitation And Credential Testing

| Tool | Used for | Trigger phrases |
|---|---|---|
| `metasploit` | Exploitation framework and post-exploitation workflows. | metasploit, msfconsole |
| `impacket` | Windows protocol tooling, secretsdump, psexec, Kerberos workflows. | impacket, secretsdump |
| `hydra` | Network login brute forcing. | hydra, brute force |
| `john` | CPU password hash cracking. | john, crack hash |
| `hashcat` | GPU password hash cracking. | hashcat, gpu crack |
| `evil-winrm` | WinRM shell and pass-the-hash workflows. | evil-winrm, winrm shell |
| `crackmapexec` | Multi-protocol lateral movement and execution. | crackmapexec, cme |
| `mimikatz` | Windows credential extraction. | mimikatz, credential dump |

### Web Application Testing

| Tool | Used for | Trigger phrases |
|---|---|---|
| `burpsuite` | Web application proxy, scanning, and testing workflows. | burp, burpsuite |
| `ffuf` | HTTP fuzzing for content and parameters. | ffuf, fuzz |
| `dirsearch` | Web path brute forcing. | dirsearch |
| `feroxbuster` | Recursive web content discovery. | feroxbuster |
| `gobuster` | Directory, DNS, and vhost brute forcing. | gobuster |
| `arjun` | Hidden HTTP parameter discovery. | arjun, hidden params |
| `sstimap` | Server-side template injection testing. | sstimap, ssti |

### Wireless Testing

| Tool | Used for | Trigger phrases |
|---|---|---|
| `aircrack-ng` | Wireless packet capture, deauth, and WPA cracking. | aircrack, wifi crack |
| `bettercap` | MITM and network interception workflows. | bettercap, mitm |
| `kismet` | Passive wireless discovery. | kismet, wireless discovery |
| `wifite` | Automated WPS and WPA attacks. | wifite |
| `ettercap` | ARP poisoning and credential sniffing. | ettercap |

### Forensics And Malware Analysis

| Tool | Used for | Trigger phrases |
|---|---|---|
| `autopsy` | Disk image ingest and case analysis. | autopsy, forensic case |
| `volatility3` | Memory dump analysis. | volatility, memory dump |
| `dc3dd` | Forensic block device imaging. | dc3dd, image disk |
| `sleuthkit` | Filesystem and inode forensic analysis. | sleuthkit, fls, icat |
| `binwalk` | Firmware extraction and analysis. | binwalk, firmware |
| `ghidra` | Binary reverse engineering. | ghidra, decompile |
| `bulk-extractor` | Artifact extraction from evidence images. | bulk extractor |
| `yara` | Malware pattern scanning. | yara, malware scan |
| `guymager` | Forensic disk imaging. | guymager |
| `rekall` | Memory dump analysis. | rekall |
| `foremost` | File carving from disk images. | foremost, carve files |
| `plasmo` | Super timeline generation. | plasmo, timeline |
| `xplico` | PCAP protocol decoding and reconstruction. | xplico, pcap decode |
| `regripper` | Windows registry hive analysis. | regripper, registry hive |
| `hashdeep` | Evidence hash generation and verification. | hashdeep, hash set |
| `ollydbg` | Windows binary debugging. | ollydbg |

### Traffic And Network Monitoring

| Tool | Used for | Trigger phrases |
|---|---|---|
| `tshark` | PCAP protocol analysis. | tshark, pcap inspect |
| `tcpdump` | Live packet capture. | tcpdump, packet capture |
| `dsniff` | Cleartext credential sniffing. | dsniff |
| `responder` | LLMNR/NBT-NS poisoning and NTLM hash capture. | responder |
| `scapy` | Custom packet injection and analysis. | scapy |

### Privacy And System Hygiene

| Tool | Used for | Trigger phrases |
|---|---|---|
| `anonsurf` | Route traffic through Tor. | anonsurf |
| `tor` | Tor network operations. | tor |
| `mat2` | Remove metadata from files. | mat2, strip metadata |
| `bleachbit` | Secure deletion of logs and caches. | bleachbit |
| `gparted` | Disk partitioning. | gparted |

### Reverse Engineering

| Tool | Used for | Trigger phrases |
|---|---|---|
| `radare2` | Binary disassembly and static analysis. | radare2, r2 |
| `cutter` | Headless binary reverse engineering. | cutter |
| `vscodium` | Launch local code editor. | vscodium |

### Blue Team And Reporting

| Tool | Used for | Trigger phrases |
|---|---|---|
| `snort` | Network intrusion detection monitoring. | snort, ids |
| `bloodhound` | Active Directory attack path mapping. | bloodhound |
| `log2timeline` | Generate forensic timelines. | log2timeline |
| `timesketch` | Search forensic timelines through Timesketch. | timesketch |
| `stix` | Export STIX 2.1 threat intelligence bundles. | stix |
| `cyberchef` | Transform and decode data through CyberChef workflows. | cyberchef |

## Full Name Index

`agent-sync`, `aircrack-ng`, `amass`, `anonsurf`, `apa_format`, `arjun`, `autopsy`, `base64-codec`, `bettercap`, `binwalk`, `bleachbit`, `blog-approve`, `blog-create`, `blog-delete`, `blog-edit`, `blog-generate-page`, `blog-list`, `blog-newsletter-send`, `blog-publish`, `blog-reject`, `blog-research-log`, `blog-research-run`, `blog-research-status`, `blog-review`, `blog-search-source`, `blog-show`, `blog-subscriber-list`, `blog-subscriber-stats`, `bloodhound`, `browser-back`, `browser-cdp`, `browser-click`, `browser-console`, `browser-dialog`, `browser-get-images`, `browser-navigate`, `browser-press`, `browser-scroll`, `browser-snapshot`, `browser-type`, `browser-vision`, `bulk-extractor`, `burpsuite`, `camera_capture`, `canvas_push`, `capabilities-audit`, `censys`, `cewl`, `channel-status-snapshot`, `checkpoint-manager`, `code-exec`, `color-convert`, `computer-use`, `contacts`, `crackmapexec`, `cron-explain`, `cronjob`, `csv-parse`, `curl`, `cutter`, `cyberchef`, `dc3dd`, `debug-helpers`, `delegate-task`, `dirsearch`, `discord`, `discord-admin`, `disk-usage`, `dmitry`, `documents-manage`, `dsniff`, `email-list`, `email-send`, `email-smtp-send`, `env-presence`, `ettercap`, `evil-winrm`, `feishu-chat-send`, `feishu-doc`, `feishu-drive`, `feishu-user-lookup`, `feroxbuster`, `ffuf`, `file-read`, `file-write`, `foremost`, `generate-pdf`, `ghidra`, `git-brief-status`, `gobuster`, `gparted`, `guymager`, `ha-call-service`, `ha-get-state`, `ha-list-entities`, `ha-list-services`, `hashcat`, `hashdeep`, `hex-encode`, `homeassistant`, `http-request`, `hydra`, `image-generation`, `images-gallery`, `impacket`, `ip-parse`, `jamovi_analyze`, `john`, `json-format`, `kanban`, `kanban-block`, `kanban-comment`, `kanban-complete`, `kanban-create`, `kanban-heartbeat`, `kanban-link`, `kanban-list`, `kanban-show`, `kanban-unblock`, `kismet`, `learning-status`, `legion`, `location_get`, `location_watch`, `location_watch_stop`, `log2timeline`, `lsp`, `maltego`, `markdown-to-text`, `masscan`, `mat2`, `mcp`, `memory`, `metagoofil`, `metasploit`, `mimikatz`, `mixture-of-agents`, `n8n`, `netcat`, `nikto`, `nmap`, `node_camera_capture`, `node_canvas_render`, `node_location_get`, `node_screen_record`, `notes-manage`, `nuclei`, `ollydbg`, `patch`, `phone-control`, `plasmo`, `platform-integrate`, `process`, `pspp_analyze`, `r_analyze`, `radare2`, `random-string`, `recon-ng`, `regex-test`, `regripper`, `rekall`, `research-list`, `responder`, `rss-fetch`, `sav_read`, `sav_write`, `scapy`, `screen_record`, `secrets-audit`, `semver-compare`, `send-message`, `session-search`, `shell-exec`, `sherlock`, `shodan`, `skill-curator`, `skill-manage`, `skill-view`, `skills-list`, `sleuthkit`, `slugify-text`, `snort`, `spiderfoot`, `spotify-now-playing`, `spotify-play`, `spotify-search`, `spss_output_parse`, `spss_syntax_generate`, `spv_read`, `sqlmap`, `sstimap`, `stats_chi_square`, `stats_compare_groups`, `stats_correlation`, `stats_describe`, `stats_normality`, `stats_posthoc`, `stats_regression`, `stix`, `tcpdump`, `text-diff`, `text-hash`, `text-to-speech`, `theHarvester`, `theme`, `timesketch`, `timestamp-convert`, `tor`, `transcription`, `trello`, `tshark`, `unit-convert`, `url-parse`, `uuid-generate`, `video-analyze`, `video-generation`, `vision-analyze`, `volatility3`, `vscodium`, `web-search`, `webhook`, `whatweb`, `wifite`, `wpscan`, `x-post`, `x-search`, `xplico`, `yaml-json-convert`, `yara`, `yb-chat`, `yb-search`, `yersinia`, `yuanbao`.

## Notes For Product And Operations

1. The security tools are a premium and sensitive part of the product, but they are not the full product. The broader product moat is the workspace and execution layer that routes work into tools, integrations, memory, channels, and workflows.
2. Triggering should stay intent-based for normal users. Exact tool names are useful for developers and operators, but product UX should expose outcomes: "research", "publish", "audit", "message", "scan", "generate", "schedule", "summarize", "deploy".
3. High-risk tools should keep confirmation, authorization, scope, and audit logging. This includes shell execution, file mutation, external posting, exploitation, credential testing, disk tools, and destructive security tools.
4. Tool growth should be tracked through `capabilities-audit`, `toolset.ts`, and the risk registry so Carina remains understandable as the tool catalogue expands.
