# Action: Data Science / MLOps / Research Skills - Port the Research Subset Only (Standalone Carina)

## Goal
Port the small subset of this spec's 16 skills that need only `web-search`/`http-tool`/`shell-exec` (arXiv search, blog/RSS monitoring, structured research methodology), and decline to port the MLOps/model-hosting skills, which assume a local GPU/Python-ML environment that a property-AI SaaS product has no reason to bundle.

## Context
- Project: `core.carinaai.uk`. Node.js 22 + TypeScript 5, ESM imports, pnpm, Vitest.
- **This spec needs the second-heaviest scope cut in the batch, for a clear structural reason**: 9 of its 16 skills (`jupyter-live-kernel`, `huggingface-hub`, `evaluating-llms-harness`, `weights-and-biases`, `llama-cpp`, `obliteratus`, `serving-llms-vllm`, `audiocraft-audio-generation`, `segment-anything-model`, `dspy`) assume the host has a Python ML environment with `torch`/`transformers`/`vllm`/GPU access. Carina's actual stack is "Node.js 22 + TypeScript 5... DeepSeek (cost) with Claude + OpenAI fallback" (per `core.carinaai.uk/CLAUDE.md`'s own "Key Architecture Decisions": **"DeepSeek first for all LLM calls... Python stubs are in archive/"**). Bundling skills that teach the agent to download, fine-tune, serve, and benchmark local LLMs directly contradicts the documented "use hosted APIs, no local model infrastructure" decision. These are not Carina skills; they're a different product's MLOps catalog. Document all 9 as excluded with this one-line reason: "contradicts Carina's hosted-LLM architecture decision (see CLAUDE.md)."
- **`obliteratus`** ("Abliterate LLM refusals - diff-in-means technique") deserves a more pointed note: this is a jailbreaking/safety-removal technique. Shipping it as a discoverable Carina skill would directly conflict with the Labyrinth Scout security posture this whole product line is built around (`06-scout-integration.md` verified the prompt-injection shield, kill switch, etc. are real working code). Do not port this one under any framing - flag it explicitly as declined on safety grounds, not just architectural-mismatch grounds.
- **`archive-exploration`/`data-forensics`** ("exhaustive exploration of large digital archives... external drives, remote servers") describe broad filesystem/network reconnaissance skills. Read them with the same security lens `06-scout-integration.md` applied to tools: an LLM-driven "exhaustively explore this filesystem/remote server" skill is exactly the kind of capability that needs to compose with `tool-policy.ts`'s allowlisting and `egress-filter.ts`'s domain controls, not bypass them via a skill that encourages broad, unscoped searching. If ported, the skill's steps must explicitly instruct the agent to stay within workspace/path boundaries (`isSafePath`) and respect rate limits - do not write a skill that reads as "go explore everything you can reach."
- **The remaining 5 skills are genuinely portable** with existing tools (`web-search`, `http-tool`) and no new infrastructure: `arxiv`, `blogwatcher`, `polymarket`, `llm-wiki`, `comprehensive-investigation`.
- Read `src/tools/web-search.ts` and `src/tools/http.ts` to confirm what API surface these new skills can lean on (rate limiting, caching - the spec explicitly asks research skills to "handle rate limits and caching for external APIs").

## Files to create
- `src/skills/packs/research-basics/skills.ts`
- `src/skills/packs/research-basics/pack.json`

## Step-by-step

1. **Surface the cut to the user first**: 16 specced skills, 5 portable as-is, 2 (`archive-exploration`/`data-forensics`) portable only with explicit safety-boundary language added, 9 declined for architectural mismatch (contradicts the hosted-LLM decision), 1 (`obliteratus`) declined on safety grounds outright. Get a nod before investing further - the user may have a specific reason to want one of the "declined" ones (e.g. they run a self-hosted model elsewhere), in which case that's a deliberate choice to make WITH them.

2. Write the 5 portable skills as `PackSkillInput` entries:
   - `arxiv-search`: trigger words (`"arxiv"`, `"paper"`, `"research paper"`, `"academic paper"`); steps describing how to query arXiv's API (it's a plain HTTP API with an Atom-feed response - `http-tool` can call it directly; no CLI needed) by keyword/author/category/ID, how to parse and present results (title, authors, abstract, link), and rate-limit etiquette (arXiv asks for max ~1 request per 3 seconds - state this as an explicit instruction in the steps prose, since the agent has no built-in awareness of third-party rate-limit policies)
   - `blog-monitoring`: trigger words (`"RSS"`, `"blog"`, `"monitor this feed"`, `"check for new posts"`); steps describing fetching and parsing RSS/Atom feeds via `http-tool` (note: this needs basic XML parsing - check `package.json` for an existing XML/feed parser before adding one; if none exists, a simple regex-based title/link extraction may suffice for the common feed formats, or this becomes a small new dependency to add and justify)
   - `polymarket-query`: trigger words (`"polymarket"`, `"prediction market"`, `"betting odds"`); steps describing Polymarket's public API endpoints (markets, prices, orderbooks, history), how to interpret and present odds/probabilities to a non-trader audience
   - `llm-wiki-style-notes`: reinterpret loosely - the spec describes "Karpathy's LLM Wiki, build/query interlinked markdown knowledge base." Carina has no wiki infrastructure; reinterpret this as a skill for building a small set of cross-referenced markdown notes via `file-write` when the user is researching a topic in depth - "create an interlinked note structure as you learn," using plain files and relative markdown links, not a dedicated wiki engine
   - `comprehensive-investigation`: a pure-methodology skill (like `systematic-debugging` in `03-devops-github-dev.md`) - "systematic deep-dive methodology": define the question, enumerate sources, triangulate across them, note confidence levels and contradictions, synthesise. No tool dependency beyond whatever sources the investigation needs (`web-search`, `http-tool`, `file-read`).

3. If the user approves porting `archive-exploration`/`data-forensics`, write them with explicit, prominent boundary language baked into the `steps` prose itself (not just a side note) - e.g. "Before searching, confirm the target path/host is within the user's stated scope. Do not recursively enumerate directories outside the workspace root. Stop and ask before following symlinks that lead outside the search root." This is the kind of skill where the prose IS the safety mechanism (skills are instructions to an LLM, not sandboxed code), so write it as carefully as you'd write a security policy, because that's effectively what it is.

4. Write `pack.json` with an honest `skillCount` (5, or 7 if the archive/forensics pair is approved).

5. Wire into `src/skills/index.ts` (or the generic loader from `06-domain-pack-system.md`, if it exists - check first).

6. Document the full exclusion list in your completion summary: the 9 MLOps skills (with the CLAUDE.md architectural citation), `obliteratus` (with the explicit safety reasoning, separate from the architectural one), and the conditional status of `archive-exploration`/`data-forensics`.

## Expected behavior
- "Find recent papers on retrieval-augmented generation" returns real arXiv results with abstracts and links, fetched directly via HTTP, respecting rate-limit etiquette.
- "What's Polymarket pricing on X" returns real market data, presented in plain language.
- The agent never attempts to download, serve, fine-tune, or "abliterate" a local LLM - that capability simply isn't in its skill set, by design, not by oversight.

## Test
```bash
cd core.carinaai.uk
pnpm vitest run src/skills/
pnpm test
pnpm build
```
Manual check:
```
In a Carina session: "Find me 3 recent arXiv papers about AI agents and summarise their abstracts"
```

## Dependencies
- `web-search`/`http-tool` (already exist, no new tools needed for the 5 core ports)
- Possibly a minimal feed-parsing dependency for `blog-monitoring` (check transitive deps before adding one)
- User sign-off on the cut list before significant time is spent - this spec has the highest ratio of "described but inappropriate" content in the batch
