import { setAuthorizationPassphrase, rotatePassphrase, isToolGenerationEnabled } from './auth-gate.js';

export const setupToolGenAuth = {
  name: 'setup_tool_gen_auth',
  description: `Configure or change the authorization passphrase for tool generation.

This is a one-time setup. After configuration:
- Every tool generation requires this passphrase
- Every tool persistence requires this passphrase (must be entered again)
- Every tool approval requires this passphrase
- 3 failed attempts triggers a 24-hour lockout

The passphrase is NEVER stored in plaintext. It is SHA-256 hashed before storage.`,
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "'set' to configure for the first time, 'rotate' to change an existing passphrase",
      },
      current_phrase: {
        type: 'string',
        description: "Current passphrase (required for 'rotate', omit for 'set')",
      },
      new_phrase: {
        type: 'string',
        description: 'The new passphrase. 12+ chars, must include uppercase, lowercase, and digit.',
      },
    },
    required: ['action', 'new_phrase'],
  },
  requiresConfirmation: true as const,
  dangerous: true as const,

  async execute(rawParams: Record<string, unknown>): Promise<unknown> {
    const args = rawParams as { action: 'set' | 'rotate'; current_phrase?: string; new_phrase: string };

    if (args.action === 'set') {
      const alreadySet = await isToolGenerationEnabled();
      if (alreadySet) {
        return { error: 'Authorization passphrase is already configured. Use action: "rotate" to change it.' };
      }

      const result = await setAuthorizationPassphrase(args.new_phrase);
      args.new_phrase = '[REDACTED]';

      if (!result.success) {
        return { error: result.error };
      }

      return {
        success: true,
        message: `Tool generation authorization configured.

From now on:
- Generating a tool requires this passphrase
- Persisting a tool requires this passphrase (must enter again)
- Approving a tool requires this passphrase
- 3 wrong attempts locks tool generation for 24 hours

WARNING: Store this passphrase securely. If lost, tool generation is permanently disabled until you reset the credential store (DELETE FROM tool_credentials WHERE key_name = 'TOOL_GEN_SECRET').`,
      };
    }

    if (args.action === 'rotate') {
      if (!args.current_phrase) {
        return { error: 'Current passphrase is required for rotation.' };
      }

      const result = await rotatePassphrase(args.current_phrase, args.new_phrase);
      args.current_phrase = '[REDACTED]';
      args.new_phrase = '[REDACTED]';

      if (!result.success) {
        return { error: result.error };
      }

      return { success: true, message: 'Authorization passphrase rotated successfully.' };
    }

    return { error: `Unknown action: ${String(args.action)}. Use "set" or "rotate".` };
  },
};
