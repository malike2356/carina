# UI.UX.components

A curated library of ready-to-use React components and agent persona definitions for the Carina platform.

Every file in this directory falls into one of two categories. Read this README before touching anything so you know what to implement, what to extract, and what to skip.

---

## Categories

### Category A: React UI Components

These files contain complete TypeScript/React components for shadcn + Tailwind + Next.js App Router projects. The `app.carinaai.uk` frontend matches this stack exactly.

Target directory inside `app.carinaai.uk`: `src/components/chat/` for chat-related components, `src/components/ui/` for primitives.

| File | Component name | Status | Notes |
|---|---|---|---|
| `ai-agent-planning.md` | `AgentPlanBlock` | IMPLEMENTED | `src/components/chat/AgentPlanBlock.tsx`. Wired into `ToolCallBlock.tsx` to auto-render when tool output has a `tasks` array. |
| `animated-ai-chat.md` | `AnimatedAIChat` | SKIP | The existing `ChatView.tsx` + `ChatInputBar.tsx` covers this. Adopting would require a full chat UI rewrite. Extract animation patterns if needed. |
| `animated-ai-chatting.md` | Variant of above | SKIP | Duplicate intent. Same reason as above. |
| `ai-chat-0.md` | `v0AIChat` | SKIP | Baseline chat component superseded by the existing implementation. |
| `ai-input-with-loading.md` | `AIInputWithLoading` | SKIP | `ChatInputBar.tsx` already has loading state via `busy` prop and `ThinkingIndicator.tsx`. Extract the loading animation CSS if you want to enhance the indicator. |
| `ai-input-with-search.md` | `AIInputWithSearch` | SKIP | Web search toggle already exists in `ChatInputBar.tsx` via the `Search` icon button and `webSearch` state. |
| `ai-prompt-box.md` | `AIPromptBox` | SKIP | Minimal prompt box, covered by existing input bar. |
| `ai-voice-imput.md` | Voice input button | SKIP | Voice input (mic button, `useVoiceInput` hook, `VoiceChat` component) is already fully implemented in `ChatInputBar.tsx`. |
| `chatGPT-style-prompt-box.md` | `PromptBox` | IMPLEMENTED | `src/components/chat/ToolsPanel.tsx` created. Tools button (Wrench icon) added to `ChatInputBar.tsx` with `showTools` / `selectedTool` state and a dismissible chip. Five tools: Create an image, Search the web, Write or code, Run deep research, Think for longer. |
| `pricing-session.md` | Pricing cards | IMPLEMENTED | `src/components/billing/PricingCards.tsx` created. Uses Carina design tokens, custom inline toggle (no Radix Switch), framer-motion animations, no canvas-confetti or NumberFlow deps. Wire in via `onPlanSelect` callback. |

### Category B: Agent Pack Definitions

These files define Anthropic Managed Agents (system prompts, MCP server configs, CLI commands). They are NOT directly runnable as-is in Carina. The CLI commands (`ant beta:agents create ...`) are for Anthropic's hosted agent platform and must be **ignored**.

What to extract: the system prompts and behavioral guardrails. Translate them into `PackSkillInput` entries in `core.carinaai.uk/src/skills/packs/`.

| File | Agent name | Carina target | Status |
|---|---|---|---|
| `ai-deep-research.md` | Deep Researcher | Enhance `research-basics` pack | IMPLEMENTED - `comprehensive-investigation` skill steps now include 3-5 sub-question decomposition, primary-source preference, per-sub-question synthesis, and a "Confidence and gaps" closing section |
| `stripe-ops-agent.md` | Stripe Ops Agent | `finance` pack: `stripe-ops` skill | IMPLEMENTED |
| `calendar-assistant-agen.md` | Calendar Assistant | `meeting-ops` pack | IMPLEMENTED |
| `zoom-recap-agent.md` | Zoom Meeting Recap | `meeting-ops` pack | IMPLEMENTED |
| `daily-competitive-intel-sweep-tarvily-agent.mg` | Tavily Competitive Intel | `meeting-ops` pack | IMPLEMENTED |
| `email-operator-agent.md` | Email Operations Copilot | `email-extended` pack: `email-outreach-ops` skill | IMPLEMENTED |
| `email-outreach-operations-agent.md` | (duplicate of above) | SKIP - identical to email-operator-agent.md | SKIP |
| `LinkedIn-Post-Scheduler.md` | LinkedIn Post Scheduler | `marketing-ops` pack | IMPLEMENTED |
| `linkedn_outreach-helper.md` | LinkedIn Outreach Helper | `marketing-ops` pack | IMPLEMENTED |
| `mailchimp-campaign-auditor-agent.md` | Mailchimp Campaign Auditor | `marketing-ops` pack | IMPLEMENTED |
| `google-ad-assist-agent.md` | Google Ads Bid Optimizer | `marketing-ops` pack | IMPLEMENTED |
| `n8n-Workflow-Designer.md` | n8n Workflow Designer | `automation` pack | IMPLEMENTED |
| `obsidian-vault-chat-rag.md` | Obsidian Vault Chat | `automation` pack | IMPLEMENTED |
| `recruitment-squad-agent.md` | Full Recruiting Squad | `recruitment` pack | IMPLEMENTED |
| `whatsapp-enquiry-assistant.md` | WhatsApp Enquiry | `social-extended` pack: `whatsapp-enquiry` skill | IMPLEMENTED |
| `telegram-alert-bot.md` | Telegram Alert Bot | `social-extended` pack: `telegram-alert` skill | IMPLEMENTED |
| `wordpress-assist-agent.md` | WordPress Assistant | `cms-ops` pack | IMPLEMENTED - `src/skills/packs/cms-ops/` with `wordpress-author` skill covering iterative drafting, tag/categorization deduplication, SEO optimization, and publish-with-confirmation pipeline |

---

## What to IGNORE in every agent definition file

Every agent definition file contains a CLI command block like this:

```bash
ant beta:agents create \
  --name '...' \
  --model '{"id": "claude-sonnet-4-6"}' \
  ...
  --mcp-server '{type: url, name: ..., url: https://mcp.something.com/mcp}'
```

**Do not run or adapt these commands.** They target Anthropic's hosted managed-agent platform, not Carina. The MCP server URLs listed (`https://mcp.stripe.com`, `https://mcp.google-calendar.com/mcp`, etc.) are Anthropic-hosted connectors that Carina does not have access to.

What Carina uses instead: the agent's built-in tool registry (`http-request`, `email-send`, `send-message`, `web-search`, `shell-exec`, etc.) and user-configured MCP servers via `ACTIVE_MCP_SERVERS` env. When translating, map MCP tool calls to the closest Carina tool.

Also ignore the `## Setup` section in each file (aaPanel/brew install instructions for the managed agent CLI).

---

## How to add a new pack from this library

1. Create `core.carinaai.uk/src/skills/packs/<pack-name>/pack.json` and `skills.ts`
2. Export a `const <camelCase>Skills: PackSkillInput[]` from `skills.ts`
3. Add the manifest entry to `src/skills/pack-manifests.ts` (PACK_MANIFESTS object)
4. Add a loader to `src/skills/pack-resolver.ts` (LEGACY_PACK_LOADERS object)
5. The `skillCount` in `pack-manifests.ts` must match the actual number of skills in `skills.ts`

Follow the shape of any existing pack (e.g., `social-extended/`) as the reference.

---

## Stack prerequisites for UI components

The `app.carinaai.uk` frontend already has:
- Next.js App Router with `"use client"` directives
- Tailwind CSS with custom design tokens (text-text-primary, bg-elevated, border-border, text-accent, bg-overlay, text-text-muted, text-danger, bg-code-bg, text-code-text)
- TypeScript
- `framer-motion` v12 (for AnimatePresence, motion, LayoutGroup)
- `lucide-react` (all icons)
- `@radix-ui/react-dialog`, `@radix-ui/react-popover`, `@radix-ui/react-tooltip`
- shadcn components in `src/components/ui/`
- `cn()` utility at `@/lib/utils`

Do NOT import shadcn class names like `bg-background`, `text-foreground`, `text-muted-foreground` directly. Map them to Carina design tokens before using:
- `bg-background` -> `bg-elevated`
- `text-foreground` -> `text-text-primary`
- `text-muted-foreground` -> `text-text-muted`
- `border` -> `border-border`
- `bg-muted` -> `bg-overlay`
- `text-primary` -> `text-accent`
- `text-destructive` -> `text-danger`

---

## Status

All items from this directory have been implemented. There are no remaining pending tasks.
