# Meta-Skill: Community Skill Format Registry; Implementation Prompt

**Gap:** 05; Security / Cross-Agent Skill Consumption  
**Prompt:** 05 of 06  
**Agent (primary):** Codex  
**Agent (fallback):** Claude Code  
**Estimated effort:** 4 days

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

The format detection engine has 14 hardcoded signatures. That covers the top 20 agent ecosystems. But new agent platforms launch every month. Their formats change. The signatures will go stale.

The solution: a community-maintained format registry. A public repository of format definitions for every known AI agent platform. Carina reads the registry to know how to parse any listed format. The community contributes new format definitions. The registry grows faster than any single team could build converters.

The registry is NOT a converter. It is a format definition; it tells Carina what the format looks like and how to map its fields to Carina canonical fields. Converters still do the heavy lifting. The registry tells the converter what to expect.

---

## What to Build

### 1. Format Definition Schema

Each format definition is a JSON/YAML file describing one agent ecosystem's skill format:

```json
{
  "$schema": "https://carinaai.uk/schemas/format-definition-v1.json",
  "id": "cursor-rules",
  "name": "Cursor Rules",
  "version": "1.2.0",
  "description": "Cursor IDE's .cursorrules and .cursor/rules/*.mdc instruction files",
  "ecosystem": "cursor",
  "homepage": "https://cursor.com",
  "detection": {
    "fileNames": [".cursorrules", "*.mdc"],
    "filePaths": [".cursor/rules/"],
    "contentPatterns": [
      "^You are an expert",
      "description:\\s*\".+\"",
      "globs:\\s*\\["
    ],
    "mimeTypes": ["text/markdown", "text/plain"]
  },
  "mapping": {
    "name": {
      "source": "fileName",
      "transform": "slugify-strip-extension"
    },
    "description": {
      "source": "content",
      "extractor": "first-paragraph"
    },
    "category": {
      "source": "static",
      "value": "imported-cursor"
    },
    "tags": {
      "source": "content",
      "extractor": "code-keywords"
    },
    "tools": {
      "source": "content",
      "extractor": "shell-commands-and-imports"
    },
    "triggers": {
      "source": "content",
      "extractor": "imperative-phrases"
    }
  },
  "permissions": {
    "defaults": {
      "network": false,
      "filesystem": [],
      "shell": false
    }
  },
  "examples": [
    {
      "input": "You are an expert in Rust development. Always use cargo clippy before committing.",
      "output": {
        "name": "rust-expert",
        "description": "Expert Rust development assistant",
        "tags": ["rust", "cargo", "clippy"]
      }
    }
  ],
  "maintainers": [
    {
      "name": "carina-core-team",
      "url": "https://github.com/carinaai/format-registry"
    }
  ],
  "createdAt": "2026-06-01T00:00:00Z",
  "updatedAt": "2026-06-18T00:00:00Z"
}
```

### 2. Registry Repository

A public GitHub repository: `github.com/carinaai/format-registry`

```
format-registry/
├── README.md                  # What this is, how to contribute
├── CONTRIBUTING.md            # Format definition spec, PR process
├── schema/
│   └── format-definition-v1.json   # JSON Schema for format definitions
├── formats/
│   ├── cursor-rules.json
│   ├── claude-md.json
│   ├── windsurf-rules.json
│   ├── copilot-instructions.json
│   ├── cline-rules.json
│   ├── aider-conventions.json
│   ├── continue-config.json
│   ├── crewai-agent.json
│   ├── langchain-config.json
│   ├── autogpt-agent.json
│   ├── devin-task.json
│   ├── replit-config.json
│   ├── generic-skill-md.json
│   └── plain-instructions.json
├── tests/
│   ├── validate-all.sh         # Validates all format defs against schema
│   └── fixtures/               # Test fixtures for each format
└── .github/
    └── workflows/
        └── validate.yml        # CI: validate all formats on PR
```

### 3. Registry Client in Carina (`src/skills/cross-agent/registry-client.ts`)

```typescript
// src/skills/cross-agent/registry-client.ts

interface FormatRegistry {
  baseUrl: string; // GitHub raw URL or CDN
  cacheExpiry: number; // Seconds before re-fetching
}

class FormatRegistryClient {
  private registryUrl: string;
  private formats: Map<string, FormatDefinition> = new Map();
  private lastFetched: number = 0;

  constructor(registryUrl?: string);

  // Fetch the latest registry from GitHub/CDN
  async refresh(): Promise<void>;

  // Get a format definition by ID
  getFormat(id: string): FormatDefinition | undefined;

  // List all available formats
  listFormats(): FormatDefinition[];

  // Search formats by ecosystem, file name, or content pattern
  searchFormats(query: string): FormatDefinition[];

  // Check if registry has updates
  async checkForUpdates(): Promise<{ hasUpdates: boolean; newFormats: string[] }>;
}
```

### 4. Dynamic Format Detection

When the format detector runs, it checks the registry FIRST, then falls back to hardcoded signatures. This means new formats added to the registry are detected immediately; no Carina update required.

```typescript
// Updated detector.ts

async function detectFormat(content: string, fileName: string): Promise<FormatDetectionResult> {
  // 1. Check registry (fetched + cached)
  const registry = await FormatRegistryClient.getInstance();
  const registryFormats = registry.listFormats();

  for (const format of registryFormats) {
    if (matchesDetection(content, fileName, format.detection)) {
      return {
        format: format.id,
        confidence: 0.95,       // Registry formats are authoritative
        converter: format.id,    // Look up converter by format ID
        metadata: extractMetadata(content, format),
      };
    }
  }

  // 2. Fall back to hardcoded signatures
  for (const sig of FORMAT_SIGNATURES) {
    // ... existing detection logic
  }

  // 3. No match → Tier 3 LLM fallback
  return { format: 'unknown', confidence: 0.0, converter: 'llm-fallback' };
}
```

### 5. CLI Commands

```bash
carina format-registry list              # List all known formats
carina format-registry search <query>    # Search formats
carina format-registry info <id>         # Show format definition details
carina format-registry update            # Fetch latest registry
carina format-registry contribute <id>   # Open PR template for new format
```

### 6. Contribution Flow

A user discovers their agent's format isn't in the registry. They:

1. Run `carina format-registry contribute my-agent`
2. Carina generates a template format definition with auto-detected patterns from their skill file
3. User edits the template, fills in missing fields
4. User submits via `carina format-registry submit my-agent.json`
5. Carina opens a PR on `github.com/carinaai/format-registry`
6. CI validates the format definition against the schema
7. Carina core team reviews and merges
8. Registry updates → all Carina instances detect the new format on next `carina format-registry update`

---

## Files to Create

```
# In format-registry repository (new repo):
format-registry/
  README.md
  CONTRIBUTING.md
  schema/format-definition-v1.json
  formats/ (14 initial format definitions)
  tests/validate-all.sh
  .github/workflows/validate.yml

# In Carina core:
core.carinaai.uk/src/skills/cross-agent/
  registry-client.ts           FormatRegistryClient
  registry-schema.ts           TypeScript types for format definitions

core.carinaai.uk/src/cli/commands/
  format-registry.ts           CLI commands
```

## Files to Modify

```
core.carinaai.uk/src/skills/cross-agent/detector.ts    Add registry-first detection
core.carinaai.uk/src/cli/registry.ts                   Register format-registry command group
```

---

## Done-When Criteria

- [ ] `github.com/carinaai/format-registry` exists with README, CONTRIBUTING, and schema
- [ ] 14 initial format definitions published and validated
- [ ] CI validates all format definitions against schema on PR
- [ ] `carina format-registry list` shows all available formats
- [ ] `carina format-registry update` fetches latest registry
- [ ] Format detector checks registry before hardcoded signatures
- [ ] New format added to registry is detected within 1 hour (cache expiry)
- [ ] `carina format-registry contribute` generates template from user's skill file
- [ ] Contribute flow opens a valid PR on the format-registry repo
- [ ] At least 2 community-contributed formats (recruit early contributors)

---

## Long-Term Vision

The format registry becomes the definitive map of AI agent skill formats. Every agent platform is listed. Every format change is tracked. Carina is the platform that keeps the map. When a new agent launches, the first thing its community does is submit a format definition so their skills work in Carina. The registry is not a Carina feature. It is a public good that Carina maintains; and benefits from disproportionately because Carina is the only platform that consumes from every ecosystem.
