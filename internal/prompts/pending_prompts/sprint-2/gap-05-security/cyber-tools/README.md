# Carina Cyber Tools; Implementation Prompts

**Date:** 2026-06-17
**Status:** IN PROGRESS
**Total Tools:** 68
**Source:** Kali Linux, Parrot OS, CSI Linux

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## MASTER INDEX

### Phase 1; Reconnaissance & OSINT (01-10)
| # | Tool | Source | Priority | Status |
|---|------|--------|----------|--------|
| 01 | nmap | Kali | CRITICAL | Done:  |
| 02 | amass | Kali | CRITICAL | Done:  |
| 03 | theHarvester | Kali | HIGH | Done:  |
| 04 | recon-ng | Kali | HIGH | Done:  |
| 05 | spiderfoot | Kali | HIGH | Done:  |
| 06 | sherlock | Kali | MEDIUM | Done:  |
| 07 | maltego | Kali | MEDIUM | Done:  |
| 08 | dmitry | Kali | MEDIUM | Done:  |
| 09 | metagoofil | Kali | MEDIUM | Done:  |
| 10 | cewl | Kali | MEDIUM | Done:  |

### Phase 2; Vulnerability Scanning (11-17)
| # | Tool | Source | Priority | Status |
|---|------|--------|----------|--------|
| 11 | nuclei | Kali | CRITICAL | Done:  |
| 12 | nikto | Kali | CRITICAL | Done:  |
| 13 | sqlmap | Kali | CRITICAL | Done:  |
| 14 | wpscan | Kali | HIGH | Done:  |
| 15 | whatweb | Kali | MEDIUM | Done:  |
| 16 | yersinia | Kali | MEDIUM | Done:  |
| 17 | legion | Kali | MEDIUM | Done:  |

### Phase 3; Exploitation & Post-Exploitation (18-25)
| # | Tool | Source | Priority | Status |
|---|------|--------|----------|--------|
| 18 | metasploit | Kali | CRITICAL | Done:  |
| 19 | impacket | Kali | HIGH | Done:  |
| 20 | hydra | Kali | HIGH | Done:  |
| 21 | john | Kali | HIGH | Done:  |
| 22 | hashcat | Kali | HIGH | Done:  |
| 23 | evil-winrm | Kali | MEDIUM | Done:  |
| 24 | crackmapexec | Kali | MEDIUM | Done:  |
| 25 | mimikatz | Kali | MEDIUM | Done:  |

### Phase 4; Web Application Testing (26-32)
| # | Tool | Source | Priority | Status |
|---|------|--------|----------|--------|
| 26 | burpsuite | Kali | CRITICAL | Done:  |
| 27 | ffuf | Kali | CRITICAL | Done:  |
| 28 | dirsearch | Kali | HIGH | Done:  |
| 29 | feroxbuster | Kali | HIGH | Done:  |
| 30 | gobuster | Kali | HIGH | Done:  |
| 31 | arjun | Kali | MEDIUM | Done:  |
| 32 | sstimap | Kali | MEDIUM | Done:  |

### Phase 5; Wireless & Network (33-37)
| # | Tool | Source | Priority | Status |
|---|------|--------|----------|--------|
| 33 | aircrack-ng | Kali | HIGH | Done:  |
| 34 | bettercap | Kali | HIGH | Done:  |
| 35 | kismet | Kali | MEDIUM | Done:  |
| 36 | wifite | Kali | MEDIUM | Done:  |
| 37 | ettercap | Kali | MEDIUM | Done:  |

### Phase 6; Forensics & Imaging (38-53)
| # | Tool | Source | Priority | Status |
|---|------|--------|----------|--------|
| 38 | autopsy | Kali | CRITICAL | Done:  |
| 39 | volatility3 | CSI | CRITICAL | Done:  |
| 40 | dc3dd | CSI | CRITICAL | Done:  |
| 41 | sleuthkit | CSI | CRITICAL | Done:  |
| 42 | binwalk | Kali | HIGH | Done:  |
| 43 | ghidra | Kali | HIGH | Done:  |
| 44 | bulk-extractor | Kali | HIGH | Done:  |
| 45 | yara | Kali | HIGH | Done:  |
| 46 | guymager | CSI | HIGH | Done:  |
| 47 | rekall | CSI | HIGH | Done:  |
| 48 | foremost | CSI | HIGH | Done:  |
| 49 | plasmo | CSI | HIGH | Done:  |
| 50 | xplico | CSI | HIGH | Done:  |
| 51 | regripper | CSI | HIGH | Done:  |
| 52 | hashdeep | CSI | HIGH | Done:  |
| 53 | ollydbg | Kali | MEDIUM | Done:  |

### Phase 7; Sniffing & Traffic (54-58)
| # | Tool | Source | Priority | Status |
|---|------|--------|----------|--------|
| 54 | wireshark/tshark | Kali | CRITICAL | Done:  |
| 55 | tcpdump | Kali | HIGH | Done:  |
| 56 | dsniff | Kali | MEDIUM | Done:  |
| 57 | responder | Kali | MEDIUM | Done:  |
| 58 | scapy | Parrot | HIGH | Done:  |

### Phase 8; Privacy, OPSEC & Anti-Forensics (59-63)
| # | Tool | Source | Priority | Status |
|---|------|--------|----------|--------|
| 59 | anonsurf | Parrot | HIGH | Done:  |
| 60 | tor | Parrot | HIGH | Done:  |
| 61 | mat2 | Parrot | HIGH | Done:  |
| 62 | bleachbit | Parrot | MEDIUM | Done:  |
| 63 | gparted | Parrot | MEDIUM | Done:  |

### Phase 9; Reverse Engineering (64-66)
| # | Tool | Source | Priority | Status |
|---|------|--------|----------|--------|
| 64 | radare2 | Parrot | HIGH | Done:  |
| 65 | cutter | Parrot | MEDIUM | Done:  |
| 66 | vscodium | Parrot | MEDIUM | Done:  |

### Phase 10; Blue Team & Defense (67-68)
| # | Tool | Source | Priority | Status |
|---|------|--------|----------|--------|
| 67 | snort | Kali | HIGH | Done:  |
| 68 | bloodhound | Kali | HIGH | Done:  |

### Phase 11; Reporting & TIP (69-72) [BONUS]
| # | Tool | Source | Priority | Status |
|---|------|--------|----------|--------|
| 69 | log2timeline | CSI | CRITICAL | Done:  |
| 70 | timesketch | CSI | HIGH | Done:  |
| 71 | stix | CSI | HIGH | Done:  |
| 72 | cyberchef | CSI | CRITICAL | Done:  |

---

## COVERAGE GAPS FOR TARGET TEAMS

### Red Team: 8/10; Strong
Offensive tools cover recon through exploitation. **Missing:** C2 frameworks (Cobalt Strike alternative like Mythic/Sliver), advanced evasion (Veil, Shellter), and cloud exploitation (ScoutSuite, Prowler).

### Blue Team: 3/10; Critical Gaps
Only snort and bloodhound. **Missing:** SIEM (Wazuh/Elastic), EDR (Velociraptor/OSQuery), network monitoring (Zeek/Suricata), deception (Cowrie/Honeyd), log management, patch auditing, configuration compliance. **Needs 15-20 additional prompts.**

### SOC: 2/10; Critical Gaps
Nothing for SOC operations. **Missing:** Case management (TheHive), alert triage (Cortex), threat intel platform (MISP), SOAR automation (Shuffle/n8n), dashboards (Grafana), incident response orchestration, PagerDuty/Jira/Slack integration. **Needs 20+ additional prompts.**

### Forensics: 6/10; Good Foundation
Disk imaging, memory analysis, timeline, registry; solid. **Missing:** Endpoint forensics (Velociraptor, KAPE), Windows forensics suite (Eric Zimmerman tools), mobile forensics (Andriller, Belkasoft), cloud forensics, browser forensics. **Needs 5-8 additional prompts.**

---

## RECOMMENDATION

1. **Proceed with all 72 prompts in this folder**; Red Team and Forensics will be well served.
2. **Create a SECOND batch: `blue-team-soc-tools/`**; 20-25 additional prompts covering:
   - Wazuh, Elastic, Splunk (SIEM)
   - Velociraptor, OSQuery, Sysmon (EDR)
   - TheHive, Cortex (SOC case management)
   - MISP (threat intel)
   - Suricata, Zeek (network detection)
   - Grafana, Prometheus (dashboards)
   - Shuffle, n8n (SOAR)
   - Honeyd, Cowrie (deception)
   - KAPE, Eric Zimmerman tools (Windows forensics)
   - Andriller, Belkasoft (mobile forensics)
3. **Create a THIRD batch: `forensics-gold-standard/`**; 8-10 prompts for forensic depth:
   - Velociraptor endpoint collection
   - KAPE triage collection
   - Eric Zimmerman tools (JLECmd, PECmd, etc.)
   - Magnet RAM capture
   - Browser history parsers
   - Cloud forensics (AWS/Azure/GCP)
   - Mobile forensics (iOS + Android)

**If you want the gold standard across all four teams, you need ~100-110 total tool prompts, not 72. The current 72 cover red teams excellently and forensics moderately. Blue team and SOC are near-zero.**

---

## PROMPT FILE STRUCTURE

Each numbered prompt file follows this template:

```
# Tool: <name> | #<NN> | <Category>

## Metadata
- Priority: CRITICAL|HIGH|MEDIUM
- Source: Kali|Parrot|CSI
- Binary: <executable>
- Package: <apt-package>
- Risk Level: low|medium|high|critical
- Requires Human Approval: yes|no

## Purpose
What the tool does in 2-3 sentences.

## Carina CLI Command
`carina <category> <action> <target>`

## TypeScript Wrapper
Full ToolDefinition with typed parameters.

## Parameters

## Requirements & Dependencies

## Workflow Chains
How this tool connects upstream and downstream.

## Usage Examples

## Output Schema
Structured JSON output format.

## Pitfalls & Edge Cases

## Verification
How to test the tool is working correctly.
```

---

## BUILD ORDER

1. **Phase 1 (Recon):** Weeks 1-2; Tools 01-10
2. **Phase 2 (Vuln):** Weeks 3-4; Tools 11-17
3. **Phase 3 (Exploit):** Weeks 5-6; Tools 18-25
4. **Phase 4 (Web):** Weeks 7-8; Tools 26-32
5. **Phase 5 (Wireless):** Weeks 9-10; Tools 33-37
6. **Phase 6 (Forensics):** Weeks 11-14; Tools 38-53
7. **Phase 7 (Sniffing):** Weeks 15-16; Tools 54-58
8. **Phase 8 (Privacy):** Weeks 17; Tools 59-63
9. **Phase 9 (RE):** Weeks 18-19; Tools 64-66
10. **Phase 10 (Blue):** Weeks 20-21; Tools 67-68
11. **Phase 11 (Report):** Weeks 22-24; Tools 69-72

**Total:** 24 weeks for 72 tools. Parallelize where possible (forensics + sniffing can run concurrently).

---

## NOTE ON BLUE TEAM / SOC GAPS

This folder has only 2 blue-team tools (snort, bloodhound) and zero SOC tools. The user has been advised that a separate `blue-team-soc-tools/` folder with 20-25 additional prompts is required for blue team and SOC coverage. This is intentional; the 72 tools here are the *offensive + forensic* core from Kali/Parrot/CSI. The defensive layer is a separate build.
