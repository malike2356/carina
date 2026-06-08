# Action: Cross-Agent Collaboration - Surface the Premise Question Before Building Anything (Standalone Carina)

## Goal
Determine, with the user, whether "Hermes" and "OpenClaw" are real agents that exist anywhere in their actual infrastructure - and if not, decline to build this spec's entire shared-memory/handoff/discovery system, since it is multi-agent integration plumbing for two products with no presence in this codebase, this monorepo, or (as far as any prior research in this batch has found) this user's world at all.

## Context
- Project: `core.carinaai.uk`. Node.js 22 + TypeScript 5, ESM imports, pnpm, Vitest.
- **This is the spec that makes the "bulk-imported from a different product's catalog" pattern undeniable**: every other phase-2/3/4 spec that mentioned "Hermes" or "OpenClaw" did so as incidental vocabulary leakage (a tool named `hermes_tools`, a path `~/.hermes/`, a skill called `openclaw-integration`) that could be stripped out, leaving genuinely-Carina-relevant content behind. **This spec is not like that - its entire subject IS the relationship between Carina, Hermes, and OpenClaw.** There is no Carina-relevant residue to extract once you remove the premise; the premise IS the spec. `grep -rln 'hermes\|Hermes\|openclaw\|OpenClaw' src/ package.json ../` (searched earlier in this batch, repeatedly, for unrelated reasons) has never found a real integration point, configuration, shared directory, or protocol - only spec-text mentions.
- **Ask the one question that determines everything else**: does VERLOX actually run Hermes and/or OpenClaw anywhere - on the same VPS, on the user's machine, anywhere reachable? If the honest answer is "no, those are just names from the spec source material," then:
  - There is nothing to discover (`.hermes/`/`.openclaw/` directories that will never exist)
  - There is nothing to sync with (a "shared memory namespace" with agents that aren't running)
  - There is no one to hand tasks to (the worked example - "Carina hands off a deploy to Hermes" - describes a capability Hermes would need to provide, that Carina cannot make exist by itself)
  - Building any of this would produce dead code: discovery logic that always finds nothing, a sync daemon that syncs with an empty set, a capability registry describing agents that never respond
- **If the answer is "yes, we actually run [agent X] somewhere"**: that changes everything, and the right next step is a much narrower, concrete spec - "integrate Carina with [the agent that actually exists, at the address/protocol it actually exposes]" - not this one, which is written for a specific pair of named products that may or may not be the right targets even if SOME cross-agent integration is wanted.
- This is exactly the kind of decision `feedback_document_all_advice` (the standing instruction to document significant recommendations) and the batch's repeated "surface scope questions before building" pattern call for - except here, there is no smaller buildable subset to fall back to the way `02-creative.md`/`05-productivity-media-etc.md` found portable slices within their grab-bags. This spec is binary: either the premise is real (in which case it needs a fresh, concrete spec written against real infrastructure) or it isn't (in which case there is nothing here to build).

## Files to create
None, pending the answer to the premise question.

## Step-by-step

1. **Ask the user directly, before any code is written**: "Do you run Hermes and/or OpenClaw anywhere - on the Contabo VPS, locally, anywhere? Is there a real second or third agent Carina should be coordinating with?" Phrase it as a yes/no/describe question, not a leading one.

2. **If the answer is no** (the expected answer, based on every signal found in this batch so far): write that down as the deliverable. Document, in the completion summary:
   - This spec describes integration with two products that do not exist in any reachable form
   - No code was written because there is nothing to integrate with - building discovery/sync/handoff machinery against agents that don't run would be speculative scaffolding, not a feature
   - If real multi-agent collaboration becomes wanted in the future, it needs a fresh spec written against whatever agent(s) actually exist, at whatever protocol they actually expose - not a port of this one
   - The one piece of this spec that IS reusable regardless: `06-delegate-task.md` already gave Carina a working internal delegation mechanism (`CarinaOrchestrator`/`SubAgent`, fresh-context sub-agents, parallel batches). If "collaborate with another agent" ever becomes real, that internal mechanism is the natural seam to extend outward (a `SubAgent` whose `execute` makes an HTTP call to an external agent's API, rather than spawning an internal one) - note this as the extension point for future-you, without building it speculatively now.

3. **If the answer is yes** (a real agent exists somewhere reachable): stop, do not attempt to build against this spec's Hermes/OpenClaw-specific assumptions (capability lists, `.hermes/`/`.openclaw/` paths, the specific handoff dialogue example). Instead, write up exactly what's real - what the other agent is, where it runs, what protocol/API it exposes, what credentials are needed - and treat "design a real cross-agent handoff with [actual agent]" as a new, properly-scoped spec to write next, not a continuation of this one. Flag this back to the user as "I need a real spec for the real agent, not this one" rather than guessing at an integration surface that may not match what actually exists.

## Expected behavior
- The user has a clear, documented answer to "should Carina talk to other agents, and which ones really exist," instead of a pile of code that discovers nothing and syncs with no one.
- If real agents exist, there's a clean, named extension point (`SubAgent` -> external-agent adapter) ready for a properly-scoped follow-up spec.
- No `.hermes/`/`.openclaw/` path-scanning code, no SQLite "shared memory" database, no capability-registry JSON describing products that aren't running, exists anywhere in the diff.

## Test
N/A - this prompt's deliverable is a decision and a documented answer, not code. If the answer turns out to be "yes, build it," the test plan belongs to whatever follow-up spec gets written for the real target.

## Dependencies
- A direct answer from the user before proceeding - this is the textbook case of "genuinely the user's call, not derivable from the code or a sensible default"
- `06-delegate-task.md`'s `SubAgent`/`CarinaOrchestrator` infrastructure, as the noted future extension point if and when a real cross-agent need emerges
