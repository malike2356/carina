# Stable public API

`@carina/core` is the planned scoped package for the semver-governed extension surface used by pack authors, tool plugins, channel adapters, and provider plugins. The current public npm install path is `carina-agent`; treat the imports below as the v0.2 API contract until the scoped package split is published.

**Version introduced:** 0.2.0

Full policy: [STABLE_API.md on GitHub](https://github.com/malike2356/carina-agent/blob/main/docs/kernel/STABLE_API.md)

## Semver rules

| Bump | Meaning |
|------|---------|
| Major | Breaking change to exports below |
| Minor | New optional manifest fields, new hooks, backward compatible |
| Patch | Bug fixes only |

## Import paths

```typescript
import { validatePackManifest } from '@carina/core/pack';
import { registerTool, type ToolDefinition } from '@carina/core/tool';
import type { ChannelAdapter } from '@carina/core/channel';
import type { MemoryBackend } from '@carina/core/memory';
import { registerProvider, type ProviderDefinition } from '@carina/core/provider';
```

Do not import from `@carina/core/dist/src/...`; those paths are internal.

## Pack manifest (`@carina/core/pack`)

Minimal valid `pack.json`:

```json
{
  "name": "my-pack",
  "version": "1.0.0",
  "description": "What this pack does",
  "author": "Your Name",
  "skillCount": 1,
  "optional": true
}
```

Validate at install time:

```typescript
import { validatePackManifest } from '@carina/core/pack';

const manifest = validatePackManifest(JSON.parse(raw), 'my-pack');
```

Required fields: `name`, `version`, `description`, `author`, `skillCount`.

## Tool registration (`@carina/core/tool`)

```typescript
import { registerTool, type ToolDefinition } from '@carina/core/tool';

const myTool: ToolDefinition = {
  name: 'my_tool',
  description: 'Does one thing',
  parameters: {
    type: 'object',
    properties: { input: { type: 'string' } },
    required: ['input'],
  },
  execute: async (params) => ({ ok: true, input: params.input }),
};

registerTool(myTool);
```

## Channel adapter (`@carina/core/channel`)

Implement `ChannelAdapter` (alias for `IChannelAdapter`):

```typescript
import type { ChannelAdapter, ChannelMessage } from '@carina/core/channel';

export class MyAdapter implements ChannelAdapter {
  readonly name = 'webhooks' as const;
  readonly enabled = true;

  parseInbound(raw: unknown): ChannelMessage | null {
    // map webhook payload to ChannelMessage
    return null;
  }

  async sendMessage(_conversationId: string, _text: string): Promise<void> {
    // outbound delivery
  }

  formatForChannel(text: string): string[] {
    return [text];
  }
}
```

Reference: [IRC stub adapter](https://github.com/malike2356/carina-agent/blob/main/src/gateway/channels/adapters/irc-adapter.ts) in the repo.

## Memory backend (`@carina/core/memory`)

Read-only stable type for integrators:

```typescript
import type { MemoryBackend } from '@carina/core/memory';
import { listMemoryBackends, describeMemoryBackends } from '@carina/core/memory';
```

Custom memory backends via npm are planned; today select built-ins via config.

## Provider registration (`@carina/core/provider`)

```typescript
import { registerProvider, type ProviderDefinition } from '@carina/core/provider';

registerProvider({
  name: 'my-provider',
  displayName: 'My Provider',
  kind: 'openai',
  apiKeyEnv: 'MY_PROVIDER_API_KEY',
  apiKeysPoolEnv: 'MY_PROVIDER_API_KEYS',
  modelEnv: 'MY_PROVIDER_MODEL',
  defaultModel: 'my-model',
  capabilities: { chat: true, tools: true, vision: false, streaming: true },
  tags: {},
  usdPerToken: 0.000002,
  fallbackPriority: 50,
  status: 'experimental',
  authType: 'api-key',
});
```

## Deprecation

Deprecated stable APIs are announced in the [CHANGELOG](https://github.com/malike2356/carina-agent/blob/main/CHANGELOG.md) and removed no sooner than the next major release.

## Related

- [Manifesto](/docs/developer/manifesto)
- [Platform architecture](/docs/developer/platform-architecture)
- [Skill packs](/docs/developer/skills/packs)
