# Action: Floor Plan / BOQ Analysis Tool (property-uk Skill Pack, Standalone Carina)

## Goal
Add a floor-plan analysis tool to the property-uk skill pack that lets Carina read a floor plan image, extract room dimensions via vision AI, generate a UK-costed Bill of Quantities, and flag HMO compliance issues.

## Context
- Project: `core.carinaai.uk`. Node.js 22 + TypeScript 5, ESM imports, pnpm, Vitest.
- The original spec described a multi-service Laravel feature (`FloorPlanAnalysisService`, `BoqCalculationService`, `FloorPlanComplianceAdvisor`, `BoqComparisonService`, controllers, jobs, models, migrations). None of that fits standalone Carina's architecture - here, capability is added as a `Tool` inside a skill pack, exactly like `land-registry-search` and `property-data-lookup`.
- Read these first (the pattern to mirror exactly):
  - `src/skills/packs/property-uk/tools/property-data.ts` - a tool that calls an external API behind an `apiKey` config check, returns a clean error object when not configured (does NOT throw - returns `{ error: '...' }` so the agent can read and relay it)
  - `src/skills/packs/property-uk/tools/land-registry.ts` - a "stub" tool pattern: returns a clear `status: 'stub'` response when the underlying integration isn't wired up yet, rather than pretending to work
  - `src/skills/packs/property-uk/skills.ts` - how a `Skill` (trigger words, step-by-step instructions, `toolsUsed`) is declared as plain data; the existing `'hmo-compliance-check'` skill already encodes UK HMO room-size minimums (6.51 sqm single, 10.22 sqm double) in prose form - your tool should produce structured numbers that this skill's prose can reference, not duplicate the legal knowledge
  - `src/tools/index.ts` - registration pattern: `if (config.X.apiKey) { registry.register(xTool); }`
  - `src/types/index.ts` - the `Tool` and `Message` interfaces
- **A real architectural gap you will hit**: `Message.content` is a plain `string` (`src/types/index.ts:5`) and `LLMRouter`/`ClaudeProvider` (`src/brain/llm.ts`) only build text-only message arrays - there is currently no support for sending image content blocks to a vision model anywhere in this codebase (`grep -rn 'image\|vision\|base64' src/brain src/agents` returns nothing). Do not attempt to retrofit multi-modal support into `LLMRouter` as part of this task - that is a much larger change with cross-cutting impact (streaming, message history, all three providers). Instead, call the Anthropic SDK directly from inside the tool (it's already a dependency: `@anthropic-ai/sdk`) using a vision-capable model (`claude-3-5-sonnet` or newer), exactly the way `ClaudeProvider` constructs its client (read `llm.ts` lines ~44-78 for the client setup and API key source), but with an image content block. This keeps the blast radius to one file.

## Files to create
- `src/skills/packs/property-uk/tools/floor-plan.ts` - the tool (single file: image analysis + BOQ costing + compliance flags, composed as one `Tool` with an `action` parameter, OR three small cooperating functions exported and wired into one `Tool.execute` - prefer one tool with an `action` enum over three separate registry entries, to avoid cluttering the tool list the LLM sees)
- `src/skills/packs/property-uk/tools/floor-plan.test.ts`
- `src/skills/packs/property-uk/knowledge/uk-refurb-costs-2025.ts` - the cost-benchmark data (painter, electrician, plasterer day rates etc.) as a typed constant, kept separate from the tool logic so it can be updated independently (check `src/skills/packs/property-uk/knowledge/` - read what's already there first; if a similar cost-data file exists, extend it instead of duplicating)

## Files to modify
- `src/tools/index.ts` - register the new tool behind a config check (see step 5)
- `src/skills/packs/property-uk/skills.ts` - optionally add a `'floor-plan-boq'` skill entry that tells the agent when/how to use the new tool (trigger words like "floor plan", "BOQ", "refurb cost", "bill of quantities")
- `src/skills/packs/property-uk/pack.json` - bump `skillCount` if you add a skill entry
- `src/config/index.ts` - if you gate the tool on an API key (see step 5), add the config block here

## Step-by-step

1. Decide the tool's interface. Recommend a single `Tool` named `floor-plan-analysis` with an `action` parameter (`'analyze' | 'generate_boq' | 'check_compliance'`) and an `imagePath` (or `imageUrl`) parameter, because:
   - The agent will naturally chain these (analyze first, then cost, then check compliance) within one conversation
   - One tool definition keeps the system prompt's tool list lean (the LLM sees every registered tool's name+description on every turn - three near-identical tools cost more context than one with a clear `action` enum)

2. Implement image loading: accept a local file path (use `src/tools/path-utils.ts`'s helpers if they provide safe path resolution - read that file first; do not write a new path-sandboxing routine if one exists) or an already-uploaded image's storage location. Read the file, base64-encode it, determine the media type from the extension (`image/jpeg`, `image/png`; reject `application/pdf` for now - vision APIs handle images, not PDFs, and converting PDFs is out of scope).

3. Implement the vision call directly via `@anthropic-ai/sdk` (per the Context note above):
   ```ts
   import Anthropic from '@anthropic-ai/sdk';
   // construct client the same way ClaudeProvider does (same API key source, src/brain/llm.ts ~line 44-50)
   const response = await client.messages.create({
     model: 'claude-3-5-sonnet-latest',
     max_tokens: 2048,
     messages: [{
       role: 'user',
       content: [
         { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
         { type: 'text', text: ANALYSIS_PROMPT },
       ],
     }],
   });
   ```
   `ANALYSIS_PROMPT` should explicitly request a JSON response with the shape: `{ property_type, rooms: [{ name, dimensions_m, area_sqm }], overall_dimensions, structural_notes }`. Parse the response defensively - vision models sometimes wrap JSON in prose or markdown fences; strip ```` ```json ```` fences before `JSON.parse`, and on parse failure return `{ error: 'Could not parse floor plan analysis', raw: <truncated response> }` rather than throwing.

4. Implement `generate_boq`: given the parsed `rooms[]` from step 3 and a `refurbType` (`'light_refresh' | 'full_refurb' | 'hmo_conversion' | 'commercial_conversion'`), compute a cost breakdown using the UK 2025 benchmark constants from `knowledge/uk-refurb-costs-2025.ts`. This is arithmetic on structured data - it does NOT need an LLM call. Write it as a pure function `calculateBoq(rooms, refurbType, costs): BoqResult` that's independently testable without mocking any network/AI calls. Return `{ rooms: [{ name, works: [{ item, cost }] }], property_summary: { subtotal, contingency, grand_total } }`. Use a contingency percentage constant (10-15% is typical for UK refurb estimates - pick one, document it as a named constant, do not hardcode the number inline).

5. Implement `check_compliance`: a pure function `checkHmoCompliance(rooms, propertyType): ComplianceResult` that compares each room's `area_sqm` against the Housing Act 2004 minimums already referenced in `skills.ts`'s `'hmo-compliance-check'` skill (single 6.51 sqm, double 10.22 sqm) and returns `{ flags: [{ room, severity: 'ERROR'|'WARNING'|'INFO', message }], score: 'GREEN'|'AMBER'|'RED' }`. Keep the legal thresholds as named constants alongside the existing skill's prose so they don't drift out of sync - consider whether the skill's hardcoded prose numbers and this tool's constants should both reference one shared source of truth in `knowledge/`.

6. Gate registration on whichever dependency makes sense - this tool needs a vision-capable Anthropic key, which the agent likely already has (it's the primary provider). Decide: should this tool be registered unconditionally (since `ANTHROPIC_API_KEY` is presumably already required for Carina to function at all), or only when the property-uk pack is active? Mirror whichever gating mechanism `03-daily-briefing.md`'s pack-activation check uses, for consistency - do not invent a third way to detect "is this pack active."

7. Write `src/skills/packs/property-uk/tools/floor-plan.test.ts` (Vitest):
   - `calculateBoq` and `checkHmoCompliance`: pure-function tests with fixed room data, no mocks - assert exact totals and exact flag severities for known inputs (e.g. a 5.5 sqm "single" room must produce an `ERROR` flag, a 7 sqm one must not)
   - The `analyze` action: mock the Anthropic client (`vi.mock('@anthropic-ai/sdk', ...)`) and test (a) a clean JSON response parses correctly, (b) a fenced-markdown response (` ```json {...} ``` `) is stripped and parsed, (c) garbage input returns the `{ error, raw }` shape without throwing
   - Image loading: test that a non-image file extension is rejected before any API call is made (so a bad upload doesn't burn a vision API call)

## Expected behavior
- `floor-plan-analysis(action: 'analyze', imagePath: ...)` returns structured room dimensions from a real floor plan photo/scan.
- `floor-plan-analysis(action: 'generate_boq', ...)` returns a UK-costed breakdown that sums correctly and includes contingency.
- `floor-plan-analysis(action: 'check_compliance', ...)` flags undersized rooms against Housing Act 2004 minimums with correct severities.
- A user can ask "analyse this floor plan and tell me what an HMO conversion would cost and whether it's compliant" and the agent chains all three actions using the one tool.

## Test
```bash
cd core.carinaai.uk
pnpm vitest run src/skills/packs/property-uk/tools/floor-plan.test.ts
pnpm test
pnpm build
```
Manual check (requires `ANTHROPIC_API_KEY` and a sample floor plan image):
```
In a Carina session: "Here's a floor plan at /path/to/sample.png - analyse it, then estimate an HMO conversion cost, then check compliance"
```

## Dependencies
- `@anthropic-ai/sdk` (already present in `package.json`)
- `ANTHROPIC_API_KEY` set and the configured model supports vision (`claude-3-5-sonnet` family or newer - confirm current model name against Anthropic's current catalogue, do not assume an old model string still works)
- A way to get an image onto the host filesystem for the tool to read (out of scope to build an upload endpoint here - if Carina has no file-upload path yet, document that as a prerequisite gap rather than building one as a side effect of this task)
