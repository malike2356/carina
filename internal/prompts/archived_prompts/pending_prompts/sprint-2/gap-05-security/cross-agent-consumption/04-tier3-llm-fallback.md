# Tier 3: LLM Universal Fallback; Implementation Prompt

**Gap:** 05; Security / Cross-Agent Skill Consumption  
**Prompt:** 04 of 06  
**Agent (primary):** Cursor  
**Agent (fallback):** Codex  
**Estimated effort:** 3 days

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Context

Tier 3 is the safety net. When format detection confidence is below 0.5, or when no converter exists for the detected format, or when the user explicitly requests LLM conversion, Carina uses a strong LLM to convert the skill.

The LLM receives the raw content, a structured conversion prompt, and the Carina canonical format schema. It outputs a Carina canonical skill. The user reviews the output before installation.

Tier 3 handles:
- Novel agent formats that don't have dedicated converters
- Proprietary/internal formats
- Raw documentation being adapted as skills
- Edge cases where detectors fail
- Any format the user explicitly wants LLM-converted

---

## What to Build

### 1. LLM Conversion Prompt (`src/skills/cross-agent/llm-converter.ts`)

The prompt is the product. It must be tested against diverse inputs and refined iteratively.

```typescript
// src/skills/cross-agent/llm-converter.ts

const CONVERSION_SYSTEM_PROMPT = `You are a skill format converter for Carina, an autonomous AI agent platform. 
Your job is to convert any instruction file from any AI agent ecosystem into Carina's canonical skill format.

## Carina Canonical Skill Format

A Carina skill is a markdown file with YAML frontmatter:

\`\`\`yaml
---
name: string           # kebab-case, lowercase, hyphens only, max 64 chars
version: "1.0.0"       # semver string
description: string    # 1-3 sentences describing what this skill does
category: string       # one of: imported-{source} | security | productivity | development | data | creative | automation
tags:                 # array of lowercase searchable tags, 2-8 items
  - example
  - skill
platforms:            # OS compatibility
  - linux
  - macos
  - windows
source:
  hub: string          # the ecosystem this came from (e.g., 'unknown', 'cursor', 'custom')
  url: string          # original URL or file path
  originalFormat: string  # original format name
  convertedAt: string  # ISO 8601 timestamp
  converterVersion: string  # "llm-fallback-1.0.0"
tools:
  required: []         # tool names this skill MUST have (empty if none)
  optional: []         # tool names that improve this skill (empty if none)
triggers: []           # keywords that auto-trigger this skill (empty if none obvious)
dependencies: []       # other skills this depends on (empty if none)
permissions:
  network: false       # conservative default: false
  filesystem: []       # conservative default: empty
  shell: false         # conservative default: false
  mcpTools: []         # conservative default: empty
---
# {skill name}

{description}

## Source

Converted from {originalFormat} via Carina LLM converter.

---

{original content, preserved verbatim}
\`\`\`

## Conversion Rules

1. **Extract the name** from the file name (without extension), first heading, or first line. Slugify to kebab-case.
2. **Extract the description** from the first meaningful paragraph. If the content is code, describe what it does.
3. **Identify the ecosystem** from patterns in the content. Be conservative; "unknown" is better than wrong.
4. **Extract tags** from language names, framework references, tool names, and key concepts mentioned.
5. **Identify triggers** from imperative phrases: "when asked to", "always do", "when the user wants to".
6. **Identify tool requirements** from shell commands, code imports, API calls, and package references.
7. **Set permissions conservatively**; all false/empty by default. Only set true if the skill explicitly requires network, filesystem, or shell access.
8. **Preserve the original content** verbatim in the skill body. Add a clear "Converted from" header.
9. **Never hallucinate**; if you're unsure about any field, leave it at the default. It's better to be incomplete than wrong.
10. **Output ONLY the valid Carina skill markdown.** No explanations. No commentary. No markdown fences around the output. Just the YAML frontmatter + markdown body.`;

const CONVERSION_USER_PROMPT = (content: string, fileName: string, detectedFormat: string) =>
  `Convert the following ${detectedFormat} file to Carina canonical skill format.

File name: ${fileName}
Detected format: ${detectedFormat}

---ORIGINAL CONTENT---
${content.slice(0, 16000)}
---END ORIGINAL CONTENT---

Output a complete Carina skill with YAML frontmatter and markdown body. Preserve all original content.`;
```

### 2. Conversion Service (`src/skills/cross-agent/llm-service.ts`)

```typescript
// src/skills/cross-agent/llm-service.ts

interface LlmConversionResult {
  skill: CarinaSkill;
  warnings: string[];
  confidence: number; // 0.0-1.0, LLM's self-assessed confidence
  rawOutput: string; // Raw LLM output for debugging
  tokensUsed: number;
  provider: string;
  model: string;
}

async function llmConvert(
  content: string,
  metadata: FormatMetadata,
  options?: {
    model?: string; // Override default LLM
    review?: boolean; // Require user review before install (default: true)
  }
): Promise<LlmConversionResult> {
  // 1. Estimate tokens. If >16K, chunk and process in parts.
  // 2. Call LLM with system + user prompts
  // 3. Parse YAML frontmatter from output
  // 4. Validate against CarinaSkill schema
  // 5. If validation fails, retry once with error feedback
  // 6. Return result with warnings
}
```

### 3. Review UI (TUI + CLI)

Before installation, the user must review LLM-converted skills. This is critical; LLMs can hallucinate.

**CLI flow:**
```
$ carina skills install ~/my-custom-agent-rules.md

  WARNING:   Format not recognized. Attempting universal conversion via LLM...
  Using: Claude Sonnet 4

  ┌─────────────────────────────────────────────────────────┐
  │ Converted Skill Preview                                  │
  │                                                          │
  │ Name:        my-custom-agent-rules                       │
  │ Description: Custom coding conventions for TypeScript    │
  │ Category:    imported-unknown                            │
  │ Tags:        typescript, coding, conventions, linting    │
  │ Triggers:    typescript expert, code review              │
  │ Tools:       none detected                               │
  │ Permissions: network: false, filesystem: false           │
  │                                                          │
  │ ─── Skill Body (first 500 chars) ───                     │
  │ # My Custom Agent Rules                                  │
  │ Always use strict TypeScript. Never use `any`...         │
  │ ...                                                      │
  │ ─────────────────────────────────────                    │
  │                                                          │
  │ Actions:                                                 │
  │   [i] Install    [e] Edit before install                 │
  │   [v] View full  [r] Re-convert with different model     │
  │   [c] Cancel                                            │
  └─────────────────────────────────────────────────────────┘

  Choice:
```

### 4. Model Selection

Use the operator's configured default model for conversion. Allow override:

```bash
carina skills install weird-format.md --llm-model claude-sonnet-4
carina skills install weird-format.md --llm-model gpt-4o
```

The conversion model should be a capable model (not a cheap/fast one). Default to the operator's main provider. Allow `--llm-model` to override.

### 5. Chunking for Large Files

Skills over 16K characters are chunked:
1. Split into sections by markdown headers
2. Process each section independently
3. Merge frontmatter from first section with body from all sections
4. Flag in warnings: "Large skill chunked into N parts for conversion"

### 6. Validation and Retry

After LLM output:
1. Parse YAML frontmatter
2. Validate against CarinaSkill schema (all required fields present, types correct)
3. If validation fails, retry once with the validation errors in the prompt:
```
Your previous output failed validation:
- Missing required field: "description"
- Invalid type for "tags": expected array, got string

Please correct these errors and output the complete skill again.
```
4. If retry fails, show raw output to user with manual edit option

---

## Files to Create

```
core.carinaai.uk/src/skills/cross-agent/
  llm-converter.ts           Conversion prompts + parsing
  llm-service.ts              LLM call + validation + retry
```

## Files to Modify

```
core.carinaai.uk/src/skills/cross-agent/pipeline.ts    Add Tier 3 routing
core.carinaai.uk/src/cli/commands/skills.ts             Add --llm-model flag + review UI
```

---

## Done-When Criteria

- [ ] Unknown format files are routed to LLM conversion
- [ ] Detected format with confidence < 0.5 is routed to LLM conversion
- [ ] `carina skills install <path> --llm` forces LLM conversion regardless of detection
- [ ] LLM output is parsed into valid CarinaSkill format
- [ ] Validation failures trigger one retry with error feedback
- [ ] User sees review UI before installation (name, description, tags, triggers, permissions)
- [ ] User can edit before install, view full, re-convert with different model, or cancel
- [ ] Files over 16K characters are chunked and merged correctly
- [ ] Conversion metadata is preserved: `source.originalFormat`, `source.converterVersion: "llm-fallback-1.0.0"`
- [ ] Converted skill passes security sandbox before install
- [ ] At least 5 diverse test cases pass: custom markdown, raw text, Python script, JSON config, YAML config

---

## Prompt Engineering Notes

The conversion prompt above is a starting point. Expect to iterate on it. Common failure modes to watch for:
- LLM inventing tool requirements that don't exist
- LLM missing triggers that are obvious in the content
- LLM outputting markdown fences around the YAML (strip them)
- LLM truncating long skill bodies
- LLM using non-kebab-case names with spaces

Test the prompt against at least 20 diverse inputs before shipping. Collect failure cases and refine.
