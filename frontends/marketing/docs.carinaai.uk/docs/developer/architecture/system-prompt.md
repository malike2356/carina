# System prompt

The system prompt defines Carina's identity, capabilities, safety rules, and workspace-specific instructions for every turn.

## Composition layers

Prompts are assembled from multiple sources (later layers override earlier where allowed):

1. **Platform base** - Core behaviour and tool honesty (`agents/system-prompt.ts`)
2. **Profile personality** - Tone and role from active profile
3. **Skill packs** - Domain instructions injected when packs are active
4. **Standing orders** - User-defined persistent directives
5. **Memory snippets** - Retrieved episodic or workspace memories
6. **Channel overlay** - Surface capability contract (web vs Telegram vs CLI)

## Surface honesty

Carina adjusts claims about memory, tools, and Scout based on the active surface (`product/surface-capabilities.ts`). Cloud BYOK mode may omit episodic memory unless core proxy is enabled.

## Editing

- Self-host: edit profile files under `~/.carina/profiles/` or use `carina personality`
- Cloud: workspace settings and enabled skill packs

Avoid putting secrets in prompts; use env and JIT credential tools instead.

## Source references

- `agents/system-prompt.ts`
- `profiles/personality.ts`
- `agents/standing-orders.ts` (when enabled)

## Related

- [Agent loop](/docs/developer/architecture/agent-loop)
- [Truth in advertising (capabilities)](/docs/capabilities)
