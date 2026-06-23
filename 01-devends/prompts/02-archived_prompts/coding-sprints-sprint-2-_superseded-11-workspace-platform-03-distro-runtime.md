# Prompt 03: Distro Runtime Engine


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Context

A Carina distro is a packaged configuration that turns the generic Carina agent into an
industry-specific product. For example, an ABBIS distro bundles the ABBIS skill packs,
system prompt, and UI customizations into a single installable unit.

The distro runtime loads a `carina.distro.json` file and applies its configuration to the
Carina agent on startup.

## What to Build

### 1. Distro definition format

`carina.distro.json` schema:
```json
{
  "$schema": "https://core.carinaai.uk/schemas/distro/v1.json",
  "id": "abbis",
  "name": "ABBIS Practice Manager",
  "version": "1.0.0",
  "description": "Carina configured for ABBIS legal practice management",
  "extends": null,
  "branding": {
    "agentName": "ABBIS Assistant",
    "primaryColor": "#1e40af",
    "logoUrl": "/distros/abbis/logo.png"
  },
  "systemPrompt": {
    "file": "prompts/abbis-system.md",
    "variables": {
      "practiceArea": "Property Law"
    }
  },
  "skills": {
    "required": ["abbis-case-management", "abbis-billing", "property-uk"],
    "optional": ["web-search", "document-reader"]
  },
  "tools": {
    "allowed": ["read-file", "write-file", "web-search", "calendar"],
    "blocked": ["nmap", "nikto", "nuclei"]
  },
  "channels": {
    "enabled": ["web", "email", "whatsapp"],
    "disabled": ["sms"]
  },
  "workflows": {
    "files": ["workflows/client-intake.ts", "workflows/billing-cycle.ts"]
  },
  "memory": {
    "namespace": "abbis",
    "isolate": true
  },
  "ui": {
    "theme": "light",
    "panels": ["chat", "memory", "file-browser"],
    "hidePanels": ["terminal", "scout"]
  }
}
```

### 2. Distro loader

Create `src/distro/loader.ts`:
```typescript
export type DistroConfig = {
  id: string;
  name: string;
  version: string;
  branding: DistroBranding;
  systemPrompt: { content: string };
  skills: { required: string[]; optional: string[] };
  tools: { allowed: string[]; blocked: string[] };
  channels: { enabled: string[]; disabled: string[] };
  memory: { namespace: string; isolate: boolean };
  ui: DistroUiConfig;
};

export async function loadDistro(distroIdOrPath: string): Promise<DistroConfig> {
  let configPath: string;

  if (distroIdOrPath.endsWith('.json')) {
    configPath = distroIdOrPath;
  } else {
    // Look in ~/.carina/distros/<id>/carina.distro.json
    configPath = path.join(os.homedir(), '.carina', 'distros', distroIdOrPath, 'carina.distro.json');
  }

  const raw = JSON.parse(await fs.readFile(configPath, 'utf-8'));
  await validateDistroSchema(raw);

  // Load system prompt from file reference
  if (raw.systemPrompt?.file) {
    const promptPath = path.resolve(path.dirname(configPath), raw.systemPrompt.file);
    raw.systemPrompt.content = await fs.readFile(promptPath, 'utf-8');
  }

  return raw as DistroConfig;
}
```

### 3. Distro application to agent

In `src/agents/CarinaAgent.ts`, apply distro config at startup:
```typescript
export class CarinaAgent {
  private distro: DistroConfig | null = null;

  async loadDistro(distroId: string): Promise<void> {
    this.distro = await loadDistro(distroId);
    this.applyDistroConfig();
  }

  private applyDistroConfig(): void {
    if (!this.distro) return;

    // Override system prompt
    this.systemPrompt = this.distro.systemPrompt.content;

    // Restrict tools
    this.allowedTools = this.distro.tools.allowed;
    this.blockedTools = new Set(this.distro.tools.blocked);

    // Load required skills
    for (const skillId of this.distro.skills.required) {
      this.skillRegistry.require(skillId);
    }
  }

  isToolAllowed(toolName: string): boolean {
    if (this.distro?.tools.blocked.includes(toolName)) return false;
    if (this.distro?.tools.allowed && !this.distro.tools.allowed.includes(toolName)) return false;
    return true;
  }
}
```

### 4. Distro environment variable

Set the active distro via env:
```
CARINA_DISTRO=abbis
# or
CARINA_DISTRO=/path/to/custom/carina.distro.json
```

On startup, if `CARINA_DISTRO` is set, load and apply the distro before accepting requests.

### 5. Distro schema validation

Create `src/distro/schema.ts` with Zod schema for `carina.distro.json`:
```typescript
export const distroSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  name: z.string().min(1).max(100),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  // ... all fields
});
```

Validation errors include the path to the invalid field and a human-readable message.

## Verification Checklist

- [ ] `CARINA_DISTRO=abbis carina cli` starts with ABBIS system prompt
- [ ] Tool blocked by distro returns "This tool is not available in ABBIS distro" error
- [ ] Required skill in distro is auto-loaded (no manual `carina skills install` needed)
- [ ] `carina.distro.json` with invalid id format fails validation with clear error message
- [ ] Distro name appears in Carina web UI header ("ABBIS Assistant" instead of "Carina")

## Files to Create or Modify

- CREATE `src/distro/loader.ts`
- CREATE `src/distro/schema.ts` (Zod)
- MODIFY `src/agents/CarinaAgent.ts` - add distro loading and tool filtering
- MODIFY `src/server.ts` - load distro from CARINA_DISTRO env on startup
- CREATE `src/distro/example/carina.distro.json` - example distro config
