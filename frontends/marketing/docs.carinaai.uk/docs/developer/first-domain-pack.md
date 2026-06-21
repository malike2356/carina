---
sidebar_position: 4
---

# Build your first domain pack

**Total time: ~30 minutes**

This tutorial takes you from zero to a working **hello-pack** domain pack. Domain packs add skills, optional tools, and prompt suffixes without forking the Carina kernel. The current public npm install path is `carina-agent`.

:::info Kernel vs pack
The **kernel** is MIT and ships tools, memory, and channels. **Packs** are opt-in vertical knowledge you install under `~/.carina/packs/` or publish to the [Skills Hub](https://hub.carinaai.uk). Packs never replace core security or hosting.
:::

Example source on GitHub: [hello-pack example files](https://github.com/malike2356/carina-agent/tree/main/docs.carinaai.uk/docs/developer/_examples/hello-pack) and `src/skills/packs/template/` in the repository.

---

## Part 1: Prerequisites (~5 min)

**You need**

- Node.js **22+**
- npm or pnpm
- A provider API key (OpenAI, Anthropic, or another supported provider)

**Install Carina**

```bash
npm install -g carina-agent
carina setup
carina doctor
```

`carina setup` creates `~/.carina/` (config, data, packs directory).

---

## Part 2: Scaffold a pack (~5 min)

User-installed packs live in **`~/.carina/packs/`** (not inside the kernel repo).

```bash
mkdir -p ~/.carina/packs/hello-pack/prompts
cd ~/.carina/packs/hello-pack
```

Create **`pack.json`**:

```json
{
  "name": "hello-pack",
  "version": "0.1.0",
  "description": "Hello World domain pack",
  "author": "Your Name",
  "skillCount": 1,
  "optional": true,
  "category": "demo"
}
```

Validate required fields match the [stable pack API](/docs/developer/stable-api):

```bash
carina pack list
# confirms install dir: ~/.carina/packs
```

Required manifest fields: `name`, `version`, `description`, `author`, `skillCount`. The planned stable API exposes `validatePackManifest` from `@verlox/carina-core/pack` once the scoped package split is published.

---

## Part 3: Add one skill (~10 min)

Create **`skills.json`** (simplest for local packs; no TypeScript build step):

```json
[
  {
    "name": "domain-greeting",
    "description": "Respond with a friendly domain-specific greeting when the user says hello",
    "trigger": ["hello", "hi", "greet", "introduction"],
    "steps": "1. Greet the user warmly in one or two sentences.\n2. Mention you are running with the hello-pack domain pack active.\n3. Offer to help with a simple demo task.\n4. Do not invent compliance rules or regulated data; this is a demo pack only.",
    "toolsUsed": ["file-read"]
  }
]
```

Optional prompt suffix in **`prompts/system.txt`**:

```text
You are assisting with the hello-pack demo domain pack.
Keep answers short, friendly, and free of fabricated regulatory or industry-specific claims.
```

**TypeScript alternative** (if you develop inside a cloned repo with tsx): copy `skills.ts` and `prompts/system.ts` from the [hello-pack example on GitHub](https://github.com/malike2356/carina-agent/tree/main/docs.carinaai.uk/docs/developer/_examples/hello-pack) or `src/skills/packs/template/`.

Your directory should look like:

```
~/.carina/packs/hello-pack/
  pack.json
  skills.json
  prompts/
    system.txt
```

---

## Part 4: Enable and test (~5 min)

Activate the pack:

```bash
export ACTIVE_SKILL_PACKS=hello-pack
carina packs enable hello-pack
carina packs status
```

Start chat:

```bash
carina chat
```

Try: **"Hello! What domain pack is active?"**

:::tip Checkpoint
You should see a greeting that references the hello-pack context. The agent can use the `domain-greeting` skill when triggers match.
:::

If skills do not appear, restart the CLI after enabling the pack.

---

## Part 5: Optional tool (~5 min)

Skills can reference existing kernel tools (`file-read`, `web-search`, etc.) via `toolsUsed`.

A future **custom pack tool** (for example `hello_lookup`) uses the planned stable tool API:

```typescript
import { registerTool } from '@verlox/carina-core/tool';

registerTool({
  name: 'hello_lookup',
  description: 'Return a demo greeting for a name',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Name to greet' },
    },
    required: ['name'],
  },
  async execute(params) {
    const name = String(params.name ?? 'friend');
    return { greeting: `Hello, ${name}! (hello-pack demo)` };
  },
});
```

Full draft example file: [hello-lookup.ts.example on GitHub](https://github.com/malike2356/carina-agent/blob/main/docs.carinaai.uk/docs/developer/_examples/hello-pack/tools/hello-lookup.ts.example).

In v0.2, custom tools ship in **npm pack packages** (`@carina/pack-*`) with a package entry module. The hello skill above works without a custom tool.

---

## Part 6: Share (~5 min)

**Skills Hub** (recommended for community packs):

```bash
export CARINA_HUB_TOKEN=your-publish-key
carina pack publish ~/.carina/packs/hello-pack
```

Others install with:

```bash
carina pack install hello-pack
```

**npm** (for product-grade packs):

1. Copy layout from `packages/packs/_template/` in the monorepo.
2. Set `"carina": { "pack": "./pack.json", "slug": "hello-pack" }` in `package.json`.
3. `npm publish --access public` as `@yourorg/pack-hello`.

See [Publishing a domain pack](/docs/developer/publishing-a-pack).

Optional RAG corpus: add `knowledge/*.md` and run:

```bash
carina ingest hello-pack
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Pack not loaded | Check `ACTIVE_SKILL_PACKS=hello-pack` spelling; run `carina packs status` |
| `Unknown pack` error | Confirm `pack.json` `name` matches the slug; files live in `~/.carina/packs/hello-pack/` |
| Manifest validation error | Ensure all required fields in [stable API](/docs/developer/stable-api); run validatePackManifest |
| Skill never triggers | Use words from `trigger` array; ask "hello" or "greet me" |
| Hub publish fails | Set `CARINA_HUB_TOKEN`; validate pack dir with `carina pack publish` locally against dev hub |

---

## Kernel boundary (important)

| In hello-pack | In Carina kernel |
|---------------|------------------------|
| Skills, prompt suffix, optional knowledge | Tools registry, memory, channels, CLI |
| Your `pack.json` manifest | `validatePackManifest`, pack loader |
| Hub tarball or npm package | Never ships your pack by default |

Breaking manifest or stable API changes require an [RFC](/docs/developer/rfc-process) before merge.

---

## Next steps

- [Creating skill packs (user guide)](/docs/user/skill-packs/creating-packs)
- [Publishing a domain pack](/docs/developer/publishing-a-pack)
- [Stable public API](/docs/developer/stable-api)
- Copy the built-in template: `src/skills/packs/template/README.md` on GitHub

**Community:** post your pack in [GitHub Discussions](https://github.com/malike2356/carina-agent/discussions) (Show and tell). Discord invite: TBD.

---

## Tutorial checklist

- [ ] `pack.json` validates
- [ ] `skills.json` (or `skills.ts`) loads
- [ ] `ACTIVE_SKILL_PACKS=hello-pack` set
- [ ] Chat responds with pack-aware greeting
- [ ] (Optional) Published to Hub or documented locally
