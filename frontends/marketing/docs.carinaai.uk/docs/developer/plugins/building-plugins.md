# Building plugins

This guide covers a minimal provider or hook plugin for self-hosted Carina.

## Manifest

Place a folder under `~/.carina/plugins/my-plugin/`:

```
my-plugin/
  package.json
  index.mjs
  carina.plugin.json
```

Example `carina.plugin.json`:

```json
{
  "id": "my-plugin",
  "version": "1.0.0",
  "hooks": ["message:in"],
  "provides": []
}
```

## Hook example

```javascript
export default {
  id: 'my-plugin',
  onHook(event, ctx) {
    if (event === 'message:in') {
      ctx.log.info('Inbound message', ctx.sessionId);
    }
  },
};
```

## Provider plugin

Implement the provider factory interface expected by `plugins/loader.ts` and register via `CARINA_PROVIDER_PLUGINS=/path/to/plugin`.

See existing provider plugins in the core repo for reference implementations.

## Testing

1. `carina hooks list` should show your plugin id
2. Trigger the hook with a test message
3. Run `carina doctor` after install

## Publishing

Internal plugins: commit beside your deployment config. Public plugins: publish to npm and document env vars in README.

## Safety

Plugins run with gateway privileges. Review code before enabling in production; use Scout tool policy to limit exfiltration.

## Related

- [Plugin overview](/docs/developer/plugins/overview)
- [Automation hooks](/docs/developer/automation/hooks)
