# Action: Productivity / Integrations Grab-Bag - Keep the Property-Professional Subset Only (Standalone Carina)

## Goal
Out of this spec's roughly 30 integration skills (Airtable, Notion, Linear, Google Workspace, Spotify, Minecraft, Pokemon, Philips Hue, Twitter/X, Obsidian, and more), port only the handful that a property-management professional would plausibly use, and decline the rest as belonging to a different user persona entirely.

## Context
- Project: `core.carinaai.uk`. Node.js 22 + TypeScript 5, ESM imports, pnpm, Vitest.
- **This is the largest, most heterogeneous grab-bag in the whole spec set, and the bucket-and-justify question is sharper here than anywhere else**: Carina's actual users are property professionals (landlords, letting agents, HMO operators - see `property-uk/skills.ts`'s `brr-analysis`/`hmo-compliance-check`/`deal-sourcing-workflow`). Run every one of the ~30 skills through one filter: "would a letting agent or landlord plausibly ask Carina to do this?" Most fail it immediately - `minecraft-bot`, `pokemon-tcg-pocket`, `philips-hue`, `spotify-dj`, `twitter-bot` describe consumer/hobbyist/gaming integrations for an entirely different product's audience.
- **Sort into three groups and document the reasoning for each, exactly as `02-creative.md` did**:
  - **Group A - plausibly useful to a property professional, port these (target ~4-6 skills)**: `google-workspace` (Gmail/Calendar/Drive - landlords correspond with tenants, schedule viewings, store documents), `notion`/`airtable` (many small property businesses run their CRM/portfolio tracker on one of these - pick whichever the spec documents more thoroughly, or port both if they're each a thin, similar wrapper), `linear` or general issue-tracking (more likely useful to VERLOX's own engineering use of Carina than to a landlord - consider whether this belongs in `core-engineering` from `01-autonomous-ai-agents.md`/`03-devops-github-dev.md` instead of a "productivity" pack), `ocr-and-documents` (tenancy agreements, gas safety certificates, EPCs - this is DIRECTLY relevant; check whether `05-floor-plan.md`'s OCR work or any existing document-processing tool already covers this before building fresh), `maps`/`geocoding` (property location lookups - check whether `property-uk` already has anything here, since `brr-analysis`-style skills would plausibly need addresses/postcodes resolved)
  - **Group B - generic enough to be harmless but low-value, consider only if trivial (~3-5 skills)**: `obsidian` (note-taking - generic productivity, not property-specific, but cheap to port as a thin file-based skill), `weather`, `news-digest` - these are the kind of "any AI assistant has these" skills that round out a product without being core to it
  - **Group C - wrong persona entirely, exclude with one-line reasons (~20 skills)**: `minecraft-bot`/`pokemon-tcg-pocket` (gaming - a different audience entirely), `philips-hue`/`smart-home` (consumer IoT - landlords manage OTHER PEOPLE'S homes, not their own smart-bulbs), `spotify-dj`/`music-*` (entertainment), `twitter-bot`/`social-media-*` (a property management company MIGHT want social media help, but as a focused `marketing`/`social-content` skill scoped to THEIR business, not a generic "run a Twitter bot" integration - if the spec has something closer to that narrower framing, consider it for Group A instead), anything describing red-team/OSINT/people-search tooling (out of scope for a compliance-conscious property SaaS - flag explicitly if present, the same way `04-datascience-mlops-research.md` flagged `obliteratus`)
- Read the actual spec file's full skill list before finalising the groups above - this context is written from the task summary's description ("Airtable/Notion/Linear/Google-Workspace/Spotify/Minecraft/Pokemon/Hue/Twitter/Obsidian/etc"); confirm exact names, trigger phrases, and tool requirements from the spec text itself, and adjust the grouping if a skill's actual description reads differently than its name suggests (the spec set has form for skills whose names undersell or oversell their actual scope).
- Read `src/skills/packs/property-uk/skills.ts` for tone/structure conventions, and check `src/tools/index.ts` for any existing Google/Notion/Airtable HTTP integrations before building new ones (a `google-workspace` skill might already have a usable tool if an OAuth flow exists somewhere in the codebase - search before assuming greenfield).

## Files to create
- `src/skills/packs/productivity-uk/skills.ts` (or fold Group-A entries into `property-uk` directly if they're property-context-specific enough that a separate pack is unwarranted overhead - judge based on how many you end up with; 2-3 skills probably belong in `property-uk`, 5+ generic ones probably warrant their own pack)
- `src/skills/packs/productivity-uk/pack.json` (if a separate pack is warranted)

## Step-by-step

1. Read the actual spec file in full and build the real Group A/B/C lists (the ones above are informed estimates from skill-name pattern-matching, not a verified read of this specific file's contents - verify and correct before proceeding).

2. **Surface the grouping to the user before building** - this is the highest-skill-count file in the batch (~30), and the persona-mismatch reasoning needs a sanity check from someone who knows the actual target customer better than a spec-reading agent does. State your Group A/B/C breakdown plainly and get confirmation, the same way `02-creative.md` asked for a nod on its bucket breakdown.

3. For each approved Group-A skill:
   - `google-workspace`: trigger words around `"email"`, `"calendar"`, `"schedule a viewing"`, `"send to"`; check whether any OAuth/Google API client already exists in the codebase (`grep -rln 'googleapis\|google-auth' src/ package.json`) - if not, this is a much bigger lift than "write skill steps" (it needs an OAuth flow, token storage, consent screens), and the prompt should say so plainly: "this skill cannot be meaningfully delivered without an OAuth integration that doesn't yet exist; either scope it down to read-only/already-authenticated contexts, or treat the integration as its own project"
   - `notion`/`airtable`: both have straightforward REST APIs with personal-access-token auth (much simpler than OAuth) - a thin `http-tool`-based skill is plausible here without new infrastructure; write steps describing the API calls (list/query/create/update records or pages) and how the agent should ask the user for an API token if one isn't configured (never hardcode one, never ask the user to paste it directly into chat - point them at wherever Carina stores per-user integration credentials, or note that this storage mechanism doesn't exist yet and is a prerequisite)
   - `ocr-and-documents`: check `05-floor-plan.md`'s verified OCR pipeline first - if Carina already has document/image-to-text capability, this skill is mostly "teach the agent when and how to use it for tenancy documents" (prose-only, `toolsUsed` pointing at the existing tool), not new infrastructure
   - `maps`/`geocoding`: check for an existing Google Maps/postcode-lookup integration in `property-uk` or `src/tools/` before building one; UK postcode lookups have simple free APIs (postcodes.io) that need no API key - if nothing exists, this is a small, genuinely useful new `http-tool`-based skill

4. For approved Group-B skills, keep them genuinely minimal (prose-only or thin `http-tool` wrappers) - don't let "harmless to include" become an excuse to over-invest in low-priority content.

5. Document Group C in full in your completion summary, with the one-line reason for each, exactly as `02-creative.md`'s bucket-3 treatment did - this is the artifact that prevents "did you forget about the Spotify skill?" questions six months from now.

6. Decide pack placement: if Group-A nets only 2-3 property-specific skills, fold them into `property-uk/skills.ts` directly (simpler, no new pack-registration plumbing); if it nets 5+ with a mix of property-specific and generic-productivity ones, a separate `productivity-uk` pack is warranted. Write `pack.json` only if you create the separate pack.

7. Wire into `src/skills/index.ts` (or the generic loader, if `06-domain-pack-system.md` built one).

## Expected behavior
- "Look up the postcode for this address and tell me the local authority" works via a real geocoding lookup, not a guess.
- "Find the gas safety certificate I uploaded last month" routes to the existing OCR/document pipeline if one exists.
- The agent has no skills relating to gaming, smart-home control, or social-media bot operation - because those don't serve property professionals, and the user has confirmed that reasoning.

## Test
```bash
cd core.carinaai.uk
pnpm vitest run src/skills/
pnpm test
pnpm build
```
Manual check:
```
In a Carina session: "What local authority is postcode SW1A 1AA in?"
```

## Dependencies
- `05-floor-plan.md`'s OCR pipeline, if `ocr-and-documents` is approved and reuses it
- An existing or new HTTP-based Notion/Airtable integration pattern (PAT-based auth, no OAuth needed)
- User confirmation on the Group A/B/C split before significant build time - the persona-mismatch judgment here has the highest stakes of any grouping decision in the batch, given ~30 candidates and a probable ~5-8 ported
