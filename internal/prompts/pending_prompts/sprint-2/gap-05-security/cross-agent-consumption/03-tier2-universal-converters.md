# Tier 2: Universal Skill Converters; Implementation Prompt

> **REUSE RULE:** See `REUSE-RULES.md` (one level up). Competitor names appear here for context only. All implementation must use Carina's own voice, naming, and presentation. No competitor brand names in shipped code.


**Gap:** 05; Security / Cross-Agent Skill Consumption  
**Prompt:** 03 of 06  
**Agent (primary):** Claude Code  
**Agent (fallback):** Cursor  
**Estimated effort:** 8 days

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

The format detection engine and converter framework are defined in `01-architecture.md`. This prompt implements them.

Every agent ecosystem has its own skill/instruction format. Cursor uses `.cursorrules` (markdown). Claude Code uses `CLAUDE.md` (markdown). Windsurf uses `.windsurfrules` (markdown). Aider uses `.aider.conf.yml` (YAML). Continue.dev uses `config.json` (JSON). CrewAI uses `agents.yaml` (YAML). The formats are different. The content is similar: instructions for an AI agent.

The converter pipeline normalizes all of them into Carina canonical format at install time.

---

## Architecture: Converter Pipeline

```
Raw Content + File Name
  → Format Detector (heuristic matching, 14 signatures)
  → Converter Router (format → converter function)
  → Converter (source → Carina canonical)
  → Security Validator (injection check, credential scan)
  → Skill Writer (save to skills/imported/{source}/{name}.md)
```

Every converter is a pure function: `(content: string, metadata: FormatMetadata) => CarinaSkill`.

---

## Build Phase 1: Format Detector + Converter Framework (Day 1-2)

### 1.1 Create `src/skills/cross-agent/detector.ts`

Implement the format detection engine from `01-architecture.md` Section 4. The 14 format signatures are provided in the architecture spec. Copy them exactly.

Key implementation details:
- Read first 2KB of content (not entire file; skills can be large)
- Match against all format signatures
- Return highest-confidence match
- Confidence below 0.5 → route to Tier 3 LLM fallback
- Log detection decision with rationale for debugging

### 1.2 Create `src/skills/cross-agent/types.ts`

```typescript
interface FormatMetadata {
  fileName: string;
  sourceUrl: string;
  originalFormat: string;
  content: string;
}

interface CarinaSkill {
  name: string;
  version: string;
  description: string;
  category: string;
  tags: string[];
  platforms: string[];
  source: {
    hub: string;
    url: string;
    originalFormat: string;
    convertedAt: string;
    converterVersion: string;
  };
  tools: {
    required: string[];
    optional: string[];
  };
  triggers: string[];
  dependencies: Array<{ name: string; version: string }>;
  permissions: {
    network: boolean;
    filesystem: string[];
    shell: boolean;
    mcpTools: string[];
  };
  content: string; // markdown body
}

type Converter = (content: string, metadata: FormatMetadata) => CarinaSkill;
```

### 1.3 Create `src/skills/cross-agent/pipeline.ts`

```typescript
async function ingestSkill(source: string, metadata?: FormatMetadata): Promise<CarinaSkill> {
  // 1. Fetch content if URL
  // 2. Detect format (detector.ts)
  // 3. Route to converter
  // 4. Run security sandbox
  // 5. Write to skill store
  // 6. Return CarinaSkill
}
```

---

## Build Phase 2: Priority Converters (Day 3-5)

Build converters in priority order. Each converter is one file in `src/skills/cross-agent/converters/`.

### P0 Converters

**`cursor-rules.ts`**; `.cursorrules` files
- Input: Markdown with implicit structure (headers, bold text, code blocks)
- Conversion strategy: Parse markdown structure. First heading → skill name. First paragraph → description. Bold terms → tags. Code blocks → tool requirements.
- Special handling: `.cursor/rules/*.mdc` files have YAML frontmatter with `description` and `globs`. Extract these.

**`claude-md.ts`**; `CLAUDE.md` files
- Input: Markdown, often with `# CLAUDE.md` header, section headers like `## Role`, `## Rules`, `## Preferences`
- Conversion strategy: Section headers → structured metadata. `## Role` → description. `## Rules` → triggers. `## Preferences` → tags.

### P1 Converters

**`windsurf-rules.ts`**; `.windsurfrules` files
**`copilot-instructions.ts`**; `.github/copilot-instructions.md`
**`cline-rules.ts`**; `.clinerules` files

### P2 Converters

**`aider-conventions.ts`**; `.aider.conf.yml`, `CONVENTIONS.md`
- Input: YAML config with `read-only`, `test-cmd`, `lint-cmd`, or markdown with conventions
- Conversion strategy: Extract commands as tool requirements. Conventions as skill body.

**`continue-config.ts`**; `config.json` (Continue.dev)
- Input: JSON with `models`, `slashCommands`, `tabAutocompleteModel`
- Conversion strategy: Slash commands → triggers. Model preferences → metadata in skill body.

**`crewai-agent.ts`**; `agents.yaml` (CrewAI)
- Input: YAML with `role`, `goal`, `backstory`, `tools`, `llm`
- Conversion strategy: Role → name. Goal + backstory → description. Tools → required tools. LLM config → skill body notes.

**`langchain-config.ts`**; LangChain chain/runnable configs
- Input: Python/TypeScript files with LangChain patterns
- Conversion strategy: Extract prompt templates from chain config. Tool references → required tools.

### P3-P5 Converters (Day 6-8)

**`autogpt-agent.ts`**, **`devin-task.ts`**, **`replit-config.ts`**, **`pieces-snippets.ts`**, **`taskade-agent.ts`**, **`supermaven-rules.ts`**, **`cody-config.ts`**, **`amazonq-config.ts`**, **`tabnine-config.ts`**

### Universal Converters

**`generic-skill-md.ts`**; Any YAML frontmatter + markdown
- Parses frontmatter for name, description, category, tags
- Maps known frontmatter keys from Hermes/OpenClaw/Odysseus to Carina keys
- Handles unknown frontmatter keys by preserving in `source` metadata

**`plain-instructions.ts`**; Any markdown without frontmatter
- First heading → skill name
- First paragraph → description
- Entire content → skill body
- Conservative defaults: `network: false`, `shell: false`

---

## Converter Implementation Template

Every converter follows this pattern:

```typescript
// src/skills/cross-agent/converters/cursor-rules.ts

import { Converter, CarinaSkill, FormatMetadata } from '../types.js';

export const cursorRulesConverter: Converter = (content: string, metadata: FormatMetadata): CarinaSkill => {
  // 1. Parse source format
  const sections = parseMarkdownSections(content);

  // 2. Extract name (from first heading, or filename without extension)
  const name = extractName(sections, metadata.fileName);

  // 3. Extract description (from first paragraph after heading)
  const description = extractDescription(sections);

  // 4. Extract tags (from bolded terms, code keywords)
  const tags = extractTags(content);

  // 5. Extract tool requirements (from code blocks, shell commands)
  const tools = extractToolRequirements(content);

  // 6. Extract triggers (from "when asked to", "always", "never" patterns)
  const triggers = extractTriggers(content);

  // 7. Assemble CarinaSkill
  return {
    name: slugify(name),
    version: '1.0.0',
    description: description || `Imported from Cursor: ${name}`,
    category: 'imported-cursor',
    tags: [...tags, 'cursor', 'imported'],
    platforms: ['linux', 'macos', 'windows'],
    source: {
      hub: 'cursor',
      url: metadata.sourceUrl,
      originalFormat: 'cursor-rules',
      convertedAt: new Date().toISOString(),
      converterVersion: '1.0.0',
    },
    tools: {
      required: tools,
      optional: [],
    },
    triggers: triggers.length > 0 ? triggers : [name.toLowerCase()],
    dependencies: [],
    permissions: {
      network: false,       // Default deny for imported skills
      filesystem: [],
      shell: false,         // Default deny
      mcpTools: [],
    },
    content: `# ${name}\n\n${description}\n\n---\n\n${content}`,
  };
};
```

---

## Testing Each Converter

Create a test fixture directory: `src/skills/cross-agent/__tests__/fixtures/`

```
fixtures/
  cursor/
    rust-expert.cursorrules     → expected: cursor/rust-expert.skill.md
    python-django.cursorrules   → expected: cursor/python-django.skill.md
  claude-code/
    web-dev.CLAUDE.md           → expected: claude-code/web-dev.skill.md
  crewai/
    researcher.agents.yaml      → expected: crewai/researcher.skill.md
  ...
```

Each converter has a test file that:
1. Reads the fixture
2. Runs the converter
3. Compares output to expected `.skill.md`
4. Validates output against CarinaSkill schema

---

## Files to Create

```
core.carinaai.uk/src/skills/cross-agent/
  types.ts                     Shared types (CarinaSkill, FormatMetadata, Converter)
  detector.ts                  Format detection engine (14 signatures)
  pipeline.ts                  Ingestion pipeline (detect → convert → validate → store)
  converters/
    cursor-rules.ts            .cursorrules → Carina
    claude-md.ts               CLAUDE.md → Carina
    windsurf-rules.ts          .windsurfrules → Carina
    copilot-instructions.ts    copilot-instructions.md → Carina
    cline-rules.ts             .clinerules → Carina
    aider-conventions.ts       .aider.conf.yml → Carina
    continue-config.ts         config.json → Carina
    crewai-agent.ts            agents.yaml → Carina
    langchain-config.ts        LangChain configs → Carina
    autogpt-agent.ts           ai_settings.yaml → Carina
    devin-task.ts              devin.yaml → Carina
    replit-config.ts           .replit → Carina
    pieces-snippets.ts         Pieces snippets → Carina
    taskade-agent.ts           Taskade config → Carina
    supermaven-rules.ts        Supermaven rules → Carina
    cody-config.ts             cody.json → Carina
    amazonq-config.ts          .amazonq/ → Carina
    tabnine-config.ts          .tabnine/ → Carina
    generic-skill-md.ts        Generic YAML frontmatter + MD → Carina
    plain-instructions.ts      Plain markdown → Carina
  __tests__/
    detector.test.ts
    pipeline.test.ts
    fixtures/
      cursor/
      claude-code/
      crewai/
      ... (one folder per converter)
```

## Files to Modify

```
core.carinaai.uk/src/cli/registry.ts       Add `carina skills install` with --from flag
core.carinaai.uk/src/skills/store.ts        Add imported/ skill storage path
```

---

## Done-When Criteria

- [ ] `carina skills install <url>` auto-detects format and converts to Carina canonical
- [ ] `carina skills install <path>` works for local files
- [ ] `carina skills install --from cursor <name>` works for named ecosystem installs
- [ ] All 20 converters pass their fixture tests
- [ ] Format detection correctly identifies format for 14 known signatures
- [ ] Unknown formats correctly route to Tier 3 LLM fallback (not implemented yet; just logs "routing to LLM fallback")
- [ ] Converted skills pass security sandbox validation
- [ ] Converted skills appear in `carina skills list` with correct source metadata
- [ ] Converted skills are executable by the agent (load into context, trigger works)
- [ ] `carina skills update` detects newer versions at source URL
- [ ] TypeScript compiles with zero errors

---

## Do NOT Do

- Do not build the LLM fallback conversion; that's Tier 3 (prompt 04)
- Do not build the cross-ecosystem search indexing; that's prompt 06
- Do not build the format registry; that's prompt 05
- Do not modify existing native Carina skill format; converters output to canonical format, they don't change the native format
- Do not build reverse converters (Carina → other formats); that's a future prompt