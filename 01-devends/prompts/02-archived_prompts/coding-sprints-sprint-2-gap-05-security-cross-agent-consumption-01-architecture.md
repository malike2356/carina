# Cross-Agent Skill Consumption; Full Architecture Spec

> **REUSE RULE:** See `REUSE-RULES.md` (one level up). Competitor names appear here for context only. All implementation must use Carina's own voice, naming, and presentation. No competitor brand names in shipped code.


**Date:** 2026-06-18  
**Status:** Canonical reference for implementation  
**Supersedes:** `CROSS-AGENT-SKILL-CONSUMPTION.md` (adapter-per-agent approach)

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## 1. Core Principle: Convert Once, Run Native

Every skill from any ecosystem is converted to **Carina canonical format** at install time. The converter runs once. The skill is stored as a native Carina skill. Every subsequent execution uses Carina's native skill runner. No translation layer at runtime. No adapter overhead. No format-change fragility.

```
Source Skill (any format)
  → Format Detector (identifies source)
  → Converter (source → canonical)
  → Security Sandbox (validate)
  → Carina Skill Store (native format)
  → Carina Skill Runner (executes natively)
```

The adapter approach (old spec) ran a compatibility layer on every execution. This approach converts once and forgets the source format.

---

## 2. The 3-Tier Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SKILL INGESTION PIPELINE                       │
│                                                                   │
│  User provides: URL, file path, package name, or raw content      │
│                         │                                         │
│                         ▼                                         │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │              FORMAT DETECTOR                              │     │
│  │  Reads first 2KB. Identifies format by heuristics.       │     │
│  │  Returns: { format: 'mcp-server' | 'cursor-rules' | ... }│     │
│  └───────────────────────┬─────────────────────────────────┘     │
│                          │                                        │
│         ┌────────────────┼────────────────┐                      │
│         ▼                ▼                ▼                       │
│  ┌──────────┐   ┌──────────────┐   ┌──────────────┐             │
│  │ TIER 1   │   │   TIER 2     │   │   TIER 3     │             │
│  │ MCP      │   │ Converters   │   │ LLM Fallback │             │
│  │ Native   │   │ 20 formats   │   │ Universal    │             │
│  │          │   │              │   │              │             │
│  │ Tools    │   │ Skills →     │   │ Any format   │             │
│  │ become   │   │ canonical    │   │ → canonical  │             │
│  │ Carina   │   │ Carina       │   │ via LLM      │             │
│  │ tools    │   │ skills       │   │              │             │
│  └────┬─────┘   └──────┬───────┘   └──────┬───────┘             │
│       │                │                   │                      │
│       └────────────────┼───────────────────┘                      │
│                        ▼                                          │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │              SECURITY SANDBOX                             │     │
│  │  All ingested skills pass through security validation.    │     │
│  │  Checks: injection patterns, exfiltration, credentials.   │     │
│  └───────────────────────┬─────────────────────────────────┘     │
│                          ▼                                        │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │              CARINA SKILL STORE                           │     │
│  │  skills/imported/{source}/{name}.md                       │     │
│  │  Metadata: source, sourceUrl, originalFormat, convertedAt │     │
│  └─────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Carina Canonical Skill Format

All ingested skills are converted to this format before storage. This is the single target that every converter produces.

```yaml
---
# Carina Skill Format v1.0
name: string                    # kebab-case, unique
version: string                 # semver
description: string             # 1-3 sentences
category: string                # imported-{source} | security | productivity | ...
tags: string[]                  # searchable tags
platforms: string[]             # [linux, macos, windows, android, ios]
source:                         # provenance metadata
  hub: string                   # 'mcp' | 'cursor' | 'claude-code' | 'windsurf' | ...
  url: string                   # original URL
  originalFormat: string        # 'mcp-server' | 'cursor-rules' | 'claude-md' | ...
  convertedAt: string           # ISO 8601
  converterVersion: string      # version of converter used
tools:                          # tools this skill requires
  required: string[]            # tool names that MUST be available
  optional: string[]            # tool names that improve the skill
triggers: string[]              # keywords/phrases that auto-trigger this skill
dependencies:                   # other skills this skill depends on
  - name: string
    version: string             # semver range
permissions:                    # security scoping
  network: boolean              # allow network access
  filesystem: string[]          # allowed paths (empty = none)
  shell: boolean                # allow shell commands
  mcpTools: string[]            # specific MCP tools allowed (if from MCP)
---
# Skill body (markdown)
# This is the instruction content the agent processes.
# All agent-specific markup has been normalized to Carina conventions.
```

---

## 4. Format Detection Engine

The detector reads the first 2KB of any skill file and identifies the format. Detection is heuristic-based with fallback to Tier 3 (LLM) when uncertain.

```typescript
interface FormatDetectionResult {
  format: string; // canonical format name
  confidence: number; // 0.0-1.0
  converter?: string; // which converter to route to
  metadata?: Record<string, any>; // extracted metadata (name, version, etc.)
}

const FORMAT_SIGNATURES: FormatSignature[] = [
  // MCP server configs
  {
    format: 'mcp-server',
    patterns: [
      /"mcpServers"\s*:/,                              // Claude Desktop config
      /"command"\s*:\s*"(npx|uvx|node|python)/,        // MCP server command
      /"transport"\s*:\s*"(stdio|sse|http)"/,          // MCP transport type
    ],
    confidence: 0.95,
    converter: 'mcp-native',
  },
  // Cursor rules (.cursorrules, .cursor/rules/*.mdc)
  {
    format: 'cursor-rules',
    patterns: [
      /^You are an expert/,                            // Common Cursor rule opening
      /\.cursorrules/,                                  // File path pattern
      /description:\s*".+"/,                            // .mdc frontmatter
      /globs:\s*\[/,                                     // .mdc file targeting
    ],
    confidence: 0.90,
    converter: 'cursor-rules',
  },
  // Claude Code CLAUDE.md
  {
    format: 'claude-md',
    patterns: [
      /^# CLAUDE\.MD/i,                                // Explicit header
      /CLAUDE\.MD/,                                     // Path reference
      /I am Claude/,                                    // Self-identification
      /When asked to.*always/i,                         // Instruction pattern
    ],
    confidence: 0.85,
    converter: 'claude-md',
  },
  // Windsurf rules (.windsurfrules)
  {
    format: 'windsurf-rules',
    patterns: [
      /\.windsurfrules/,
      /Windsurf Rules/,
      /windsurf:\s*true/,
    ],
    confidence: 0.85,
    converter: 'windsurf-rules',
  },
  // Aider conventions (.aider.conf.yml, CONVENTIONS.md)
  {
    format: 'aider-conventions',
    patterns: [
      /^# Aider Conventions/i,
      /\.aider\.conf\.(yml|yaml)/,
      /aider:\s*true/,
      /read-only:\s*\[/,                                // Aider config pattern
    ],
    confidence: 0.85,
    converter: 'aider-conventions',
  },
  // Continue.dev config
  {
    format: 'continue-config',
    patterns: [
      /"models"\s*:\s*\[/,                              // Continue config model list
      /"slashCommands"\s*:\s*\[/,                       // Slash commands
      /"tabAutocompleteModel"/,                         // Continue-specific key
      /"embeddingsProvider"/,                           // Continue-specific key
    ],
    confidence: 0.90,
    converter: 'continue-config',
  },
  // Cline rules (.clinerules)
  {
    format: 'cline-rules',
    patterns: [
      /\.clinerules/,
      /Cline Rules/,
      /cline_custom_instructions/,
    ],
    confidence: 0.85,
    converter: 'cline-rules',
  },
  // GitHub Copilot instructions
  {
    format: 'copilot-instructions',
    patterns: [
      /\.github\/copilot-instructions\.md/,
      /GitHub Copilot Instructions/,
      /copilot-instructions:/,
    ],
    confidence: 0.85,
    converter: 'copilot-instructions',
  },
  // CrewAI agent config
  {
    format: 'crewai-agent',
    patterns: [
      /role:\s*"[^"]+"/,                                // CrewAI agent role
      /goal:\s*"[^"]+"/,                                // CrewAI agent goal
      /backstory:\s*"[^"]+"/,                           // CrewAI agent backstory
      /tools:\s*\[/,                                     // CrewAI tools list
    ],
    confidence: 0.90,
    converter: 'crewai-agent',
  },
  // LangChain chain/runnable config
  {
    format: 'langchain-config',
    patterns: [
      /from langchain/,                                  // LangChain import
      /llm:\s*(ChatOpenAI|ChatAnthropic)/,              // LangChain LLM config
      /chain:\s*(\||Runnable)/,                          // LCEL pipe
    ],
    confidence: 0.80,
    converter: 'langchain-config',
  },
  // AutoGPT agent config
  {
    format: 'autogpt-agent',
    patterns: [
      /ai_name:\s*["']/,                                // AutoGPT config key
      /ai_role:\s*["']/,                                // AutoGPT config key
      /ai_goals:\s*\[/,                                   // AutoGPT goals
    ],
    confidence: 0.90,
    converter: 'autogpt-agent',
  },
  // Devin task config
  {
    format: 'devin-task',
    patterns: [
      /devin\.yaml/,
      /devin\.yml/,
      /tasks:\s*\n\s*-/,                                 // Devin task list
    ],
    confidence: 0.80,
    converter: 'devin-task',
  },
  // Generic YAML frontmatter + markdown (Hermes/OpenClaw/Odysseus style)
  {
    format: 'generic-skill-md',
    patterns: [
      /^---\s*\nname:\s*/,                               // YAML frontmatter with name
      /^---\s*\ndescription:/,                           // YAML frontmatter with description
    ],
    confidence: 0.75,
    converter: 'generic-skill-md',
  },
  // Plain markdown instructions (no frontmatter)
  {
    format: 'plain-instructions',
    patterns: [
      /^#+\s/,                                           // Markdown headers
      /^\*\*[^*]+\*\*/,                                  // Bold text
    ],
    confidence: 0.50,
    converter: 'plain-instructions',
  },
];

function detectFormat(content: string, fileName: string): FormatDetectionResult {
  const sample = content.slice(0, 2048);

  for (const sig of FORMAT_SIGNATURES) {
    const matchCount = sig.patterns.filter(p => p.test(sample)).length;
    const coverage = matchCount / sig.patterns.length;

    if (coverage >= 0.5) {
      return {
        format: sig.format,
        confidence: sig.confidence * coverage,
        converter: sig.converter,
        metadata: extractMetadata(sample, sig.format),
      };
    }
  }

  // No format matched → Tier 3 LLM fallback
  return {
    format: 'unknown',
    confidence: 0.0,
    converter: 'llm-fallback',
    metadata: { fileName },
  };
}
```

---

## 5. Data Flow: User Installs a Skill

```
$ carina skills install https://github.com/user/my-cursor-rules/.cursorrules

1. Carina fetches the URL → raw content: "You are an expert in Rust..."
2. Format Detector runs → { format: 'cursor-rules', confidence: 0.90, converter: 'cursor-rules' }
3. Cursor Rules Converter runs:
   - Parses markdown structure
   - Extracts implicit instructions
   - Generates Carina frontmatter:
     name: rust-expert
     description: Expert Rust programming assistant
     category: imported-cursor
     source.hub: cursor
     source.originalFormat: cursor-rules
   - Outputs canonical Carina skill
4. Security Sandbox validates → passes (no injection, no credentials)
5. Skill written to: skills/imported/cursor/rust-expert.md
6. Carina responds:
    rust-expert v1.0.0 installed from cursor ecosystem
    Source: https://github.com/user/my-cursor-rules/.cursorrules
    Converted: cursor-rules → Carina canonical format
    Ready to use. Trigger: "rust expert"
```

---

## 6. The Three Tiers in Detail

### Tier 1: MCP Native Support

MCP (Model Context Protocol) tools are NOT converted to skills. They are registered as native Carina tools. This is the correct architectural decision because MCP tools are executable functions, not instructional prompts.

```
carina mcp connect https://github.com/anthropics/mcp-servers/tree/main/src/filesystem
  → Discovers: read_file, write_file, list_directory, search_files
  → Registers as Carina tools in the current workspace
  → Tools available immediately in agent context
  → Security sandbox: filesystem MCP tools scoped to workspace root

carina mcp list
  filesystem/read_file         connected    anthropic/mcp-servers
  filesystem/write_file        connected    anthropic/mcp-servers
  postgres/query               connected    @modelcontextprotocol/server-postgres
  slack/send_message           connected    @modelcontextprotocol/server-slack
```

MCP tools co-exist with Carina's 72 cyber tools. The agent sees a unified tool list. Scout monitors MCP tool usage alongside native tool usage.

### Tier 2: Smart Converters

Each converter is a pure function: `(rawContent: string, metadata: FormatMetadata) → CarinaSkill`. Converters are stateless, testable, and individually versioned.

The 20 converters are built in priority order:

| Priority | Ecosystem | Converter | User Base | Skills Available |
|----------|----------|-----------|-----------|-----------------|
| P0 | Cursor | cursor-rules | Millions of devs | .cursorrules files |
| P0 | Claude Code | claude-md | Fastest growing | CLAUDE.md files |
| P1 | Windsurf | windsurf-rules | Growing rapidly | .windsurfrules |
| P1 | GitHub Copilot | copilot-instructions | Largest user base | .github/copilot-instructions.md |
| P1 | Cline | cline-rules | Popular VS Code | .clinerules |
| P2 | Aider | aider-conventions | Strong OSS community | .aider.conf.yml |
| P2 | Continue.dev | continue-config | Large OSS install base | config.json |
| P2 | CrewAI | crewai-agent | Leading agent framework | agents.yaml |
| P2 | LangChain | langchain-config | Largest framework | chain configs |
| P3 | AutoGPT | autogpt-agent | Pioneer | ai_settings.yaml |
| P3 | Devin | devin-task | Enterprise | devin.yaml |
| P3 | Replit Agent | replit-config | Education/startups | .replit |
| P3 | Pieces | pieces-snippets | Developer tools | snippet libraries |
| P4 | Taskade AI | taskade-agent | Productivity | custom agents |
| P4 | Supermaven | supermaven-rules | Fast completion | rules |
| P4 | Sourcegraph Cody | cody-config | Enterprise search | cody.json |
| P4 | Amazon Q | amazonq-config | AWS ecosystem | .amazonq/ |
| P4 | Tabnine | tabnine-config | Enterprise | .tabnine/ |
| P5 | Generic Skill MD | generic-skill-md | Universal | Any YAML+MD skill |
| P5 | Plain Instructions | plain-instructions | Universal | Any markdown |

### Tier 3: LLM Universal Fallback

For any format not covered by Tier 1 or Tier 2, or when format detection confidence is below 0.5, the LLM fallback handles conversion.

The LLM receives:
1. The raw skill content
2. The file name
3. A structured conversion prompt
4. The Carina canonical format schema

The LLM outputs a Carina canonical skill. The user is shown the conversion and can approve, edit, or reject.

See `04-tier3-llm-fallback.md` for the full prompt engineering spec.

---

## 7. Skill Store Layout

```
skills/
├── carina/                    # Native Carina skills
│   ├── nmap-scanner.md
│   ├── nuclei-scanner.md
│   └── ...
├── imported/                  # Skills ingested from other ecosystems
│   ├── cursor/
│   │   ├── rust-expert.md     # Converted from .cursorrules
│   │   └── python-django.md    # Converted from .cursorrules
│   ├── claude-code/
│   │   └── web-dev-agent.md   # Converted from CLAUDE.md
│   ├── windsurf/
│   │   └── typescript-pro.md  # Converted from .windsurfrules
│   ├── mcp/                    # MCP tools registered (not skills, tool references)
│   │   └── registry.json      # MCP tool → Carina tool mapping
│   └── llm-converted/          # Skills converted via Tier 3 LLM
│       ├── custom-agent.md     # Unknown format → LLM → Carina
│       └── legacy-tool.md      # Old proprietary format → LLM → Carina
```

---

## 8. CLI Commands

```bash
# Install a skill from any source
carina skills install <url>                    # Auto-detect format, convert, install
carina skills install <path>                   # Local file, same pipeline
carina skills install --from cursor <name>     # Named skill from known ecosystem
carina skills install --from claude-code <name>

# MCP tools (separate command; tools, not skills)
carina mcp connect <url>                       # Connect to MCP server
carina mcp disconnect <name>                   # Disconnect
carina mcp list                                # List connected MCP servers and tools
carina mcp tools <server>                      # List tools from a specific server

# Cross-ecosystem search
carina skills search "security scanner" --all  # Search ALL ecosystems
carina skills search "security" --hub cursor   # Search specific ecosystem
carina skills search "security" --hub mcp      # Search MCP tools

# List installed skills with source
carina skills list
  rust-expert               imported-cursor      v1.0.0    github.com/user/.cursorrules
  web-dev-agent             imported-claude-code  v1.0.0    github.com/team/CLAUDE.md
  filesystem/read_file      mcp-native           v1.0.0    anthropic/mcp-servers
  postgres/query            mcp-native           v1.0.0    @modelcontextprotocol/server-postgres
  nmap-scanner              native               v1.5.0    CarinaHub

# Update skills from their source ecosystems
carina skills update --all                       # Check all imported skills for updates
carina skills update rust-expert                 # Update specific skill from its source
```

---

## 9. Security

Every ingested skill; regardless of tier; passes through the security sandbox before installation. The sandbox checks are identical to CarinaHub's publish validation:

1. **Static analysis:** Injection patterns, hardcoded credentials, shell injection, exfiltration patterns
2. **Tool permission audit:** Skills must declare required tools. Undeclared tool usage is blocked at runtime.
3. **Network policy:** Skills from untrusted sources default to `network: false`
4. **Filesystem scoping:** Imported skills are scoped to `skills/imported/{source}/` by default

MCP tools follow the same permission model. Each MCP tool registers its required permissions. The operator approves tool permissions at connection time.

```typescript
// MCP tool permission approval
$ carina mcp connect filesystem-server
  This MCP server provides the following tools:
    read_file     → reads any file on disk
    write_file    → writes any file on disk
    list_directory → lists any directory
  
  WARNING:   These tools have BROAD file system access.
  Scoped to: /home/user/projects/ (recommended)
  
  Approve? [y/N] y
   filesystem-server connected. Tools scoped to /home/user/projects/
```

---

## 10. What Makes This Architecture Superior

**Scalability:** One new agent platform? Its skills work on day one via Tier 3 LLM fallback. Ecosystem grows large? Build a Tier 2 converter. No per-agent maintenance death spiral.

**Performance:** Skills are converted once at install time. Runtime performance is identical to native Carina skills. No adapter layer. No translation overhead.

**Portability:** The canonical Carina format is well-specified. Skills can be exported back to any ecosystem with a reverse converter. Carina becomes a publishing hub, not just a consumer.

**Security:** The security sandbox is the single gatekeeper. Every skill; MCP tool, converted skill, LLM-converted skill; passes through the same validation. One security policy. One audit trail.

**Competitive Moat:** Carina is the only agent that runs skills from every ecosystem. Cursor users bring their .cursorrules. Claude Code users bring their CLAUDE.md. MCP users bring their servers. Everyone brings everything. Carina is the union of all agent skill ecosystems.

---

## 11. Error Handling

| Scenario | Behavior |
|---|---|
| Format detection confidence < 0.5 | Route to Tier 3 LLM fallback. Show user: "Format uncertain. Attempting universal conversion..." |
| LLM conversion fails | Show user the raw content. Offer manual conversion form. |
| Security sandbox rejects skill | Show detailed rejection reason with flagged patterns. Offer to inspect and edit. |
| Source URL unreachable | Retry 3 times with exponential backoff. Cache last-known-good version. |
| Converter version incompatible | Show: "This skill was created with converter v1.2. Current converter is v2.0. Re-converting..." |
| MCP server connection fails | Show connection error details. Suggest `carina mcp doctor` for diagnostics. |
| Skill has unmet dependencies | Offer to install dependencies or skip. Show dependency tree. |