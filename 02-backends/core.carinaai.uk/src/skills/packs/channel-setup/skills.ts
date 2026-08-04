import type { PackSkillInput } from '../../pack-types.js';

export const channelSetupSkills: PackSkillInput[] = [
  {
    name: 'configure-anything',
    description: 'BotFather-style conversational setup for any Carina configuration: channels, LLM keys, workspace preferences, model selection, integrations, outbound webhooks, scout, companion pairing, voice. One field at a time. Sensitive values never repeated.',
    trigger: [
      // configuration intents
      'configure', 'connect', 'set up', 'add', 'fix', 'change', 'update', 'set my',
      // channels
      'telegram', 'slack', 'discord', 'whatsapp', 'email', 'smtp', 'imap',
      'signal', 'matrix', 'sms', 'teams', 'channel',
      // providers
      'openai', 'anthropic', 'claude', 'deepseek', 'gemini', 'groq', 'ollama', 'mistral',
      'api key', 'openai key', 'anthropic key',
      // model
      'default model', 'change model', 'switch model', 'use model', 'model',
      // workspace
      'timezone', 'language', 'quiet hours', 'do not disturb', 'notifications',
      'persona', 'agent name',
      // integrations
      'n8n', 'trello', 'caldav', 'calendar', 'resend', 'notion',
      'webhook', 'webhooks', 'outbound webhook',
      'google workspace', 'gws', 'google calendar', 'google drive',
      // search
      'search provider', 'tavily', 'brave search', 'searxng',
      // scout
      'scout', 'labyrinth scout', 'security monitoring',
      // companion / devices
      'pair phone', 'pair mobile', 'companion', 'pair device', 'pairing', 'mobile companion',
      // voice
      'tts', 'voice', 'text to speech',
    ],
    steps: `1. Identify what the user wants to configure from their message.
   - For channels: resolve alias via channel requirements ("tg"=telegram, "mail"=email, "wa"=whatsapp).
   - For LLM keys: "openai key", "add anthropic", "set deepseek" -> provider domain.
   - For model: "use gpt-4o", "switch to claude", "deepseek as default" -> model:default domain.
   - For workspace: "set timezone to London", "enable quiet hours" -> workspace domain.
   - For integrations: "connect n8n", "set up trello", "connect notion" -> integration domain.
   - For Google Workspace: "connect google workspace", "google calendar oauth" -> integration:google-workspace
     (ask for client id/secret, then share auth_url; collect oauth_code; never speak secrets).
   - For webhooks: "add webhook", "outbound webhook" -> integration:webhooks (ask for HTTPS URL one field at a time; never speak signing secret).
   - For scout: "enable scout", "connect scout" -> scout domain.
   - For companion: "pair my phone", "pair companion" -> device:companion (call set with empty values; pairing starts immediately with short code + URI).
   - For voice: "change voice", "use openai tts" -> voice:tts domain.

2. Call configure with action="set", target=<domain or channel id>, values={} (empty) to get the field list
   (except companion, which returns pairing_started with shortCode and uri;
    google-workspace may return needs_oauth with authUrl).

3. Ask the user for the first required field only. Do not dump all fields at once.
   For companion: show the short code and tell them to scan/open the pair link in Carina Mobile.
   Never speak the full pairing token aloud.
   For webhooks: after create, tell them to store the signing secret once; never speak it.
   For Google Workspace: after client credentials, share authUrl; then ask for oauth_code only.

4. If the field is sensitive (API key, password, secret, token):
   - On voice: say "If you prefer, type this one rather than speaking it aloud."
   - On web/mobile: show a masked input hint.
   - Accept spoken input without objecting; never echo the value back.
   - Confirm receipt without quoting: "Got your API key, moving on."

5. After the user provides each field value, confirm without echoing sensitive values.

6. Ask for the next required field. Repeat until all required fields collected.

7. After required fields, ask once if the user wants to fill optional fields (don't repeat if they decline).

8. Call configure with action="set", target=<domain>, values={all collected field values}.

9. Read the response:
   - If success and requiresRestart=true: explain restart is needed, offer the command.
   - If success and no restart: confirm active. Offer to test where applicable.
   - If missing_fields: ask for the remaining fields, one at a time.
   - If error: explain the problem, offer retry or docs link.

10. For test after configure: call configure with action="test", target=<domain>.

11. FORBIDDEN: Never say "go to Settings", "open the dashboard", or "find it in the config panel" as the only path. The conversation IS the configuration path.

12. If the user asks about something not yet covered: acknowledge the intent, say conversational setup for that domain is planned, and offer the closest working alternative (usually pointing to the env var they can set manually for now).`,
    toolsUsed: ['configure', 'channel_config'],
  },
  {
    name: 'list-configuration',
    description: 'Show all Carina configuration: what is set up, what is missing, and offer to configure anything.',
    trigger: [
      'what is configured', 'what have i set up', 'show configuration', 'configuration status',
      'what channels', 'which channels', 'channels connected', 'are we connected',
      'is telegram', 'is slack', 'is email', 'channel status', 'channel list',
      'what keys do i have', 'which providers', 'what models', 'what integrations',
      'show me what is set up', 'carina status', 'setup status',
    ],
    steps: `1. Call configure with action="list", no target, to get all domains and their status.
2. Group and report:
   - Configured items: name, status (active/configured/error), restart note if needed.
   - Not configured: list by category (channels, providers, workspace, integrations, etc.).
3. If any item has an error, offer to retest or reconfigure it.
4. Offer to set up any unconfigured item the user expresses interest in.
5. Keep the list concise and scannable. No marketing copy.`,
    toolsUsed: ['configure', 'channel_config'],
  },
];
