# Carina Channel Adapters

## What Channel Adapters Are

A channel adapter is the bridge between an external messaging platform and Carina's agent kernel.
The adapter receives incoming messages, normalizes them into Carina's internal message format,
routes them to the correct agent session, and delivers the agent's response back to the platform
in the format that platform expects.

The agent kernel is channel-agnostic. The same skill, the same memory, the same tools run
regardless of whether the message came from WhatsApp or Telegram or a web browser. Channel
adapters are the translation layer.

## Location in the Codebase

- Adapter files: `core.carinaai.uk/src/channels/adapters/`
- Adapter registry: `src/channels/adapter-registry.ts`
- Channel router: `src/channels/channel-router.ts`
- Message router: `src/channels/message-router.ts`
- Credential store: `src/channels/credential-store.ts`
- Channel-Scout signals: `src/channels/channel-scout-signals.ts`

## The Eight Built and Tested Adapters

### Discord (`discord-adapter.ts`)

Connects Carina to Discord servers and channels. Supports:
- Direct messages to the bot
- Mentions in guild channels
- Slash commands
- Voice channel text integration
- Multi-guild deployment from a single Carina instance

Discord admin operations (manage roles, channels, messages) are available through the
`discord-admin` tool.

### Email (`email-adapter.ts`)

Connects Carina to IMAP email accounts. Supports:
- Monitoring inbox for new messages
- Parsing structured data from emails
- Composing and sending replies via the configured SMTP/IMAP account
- Thread awareness (replies stay in the same thread)
- The Aiva email ingestion pipeline (`src/ingestion/email/`) extends this with IMAP polling,
  email classification, and data extraction into Aiva worker context

Test coverage: `email-adapter.test.ts`

### Slack (`slack-adapter.ts`)

Connects Carina to Slack workspaces. Supports:
- Direct messages to the Carina bot
- App mentions in channels
- Thread replies (Carina responds in-thread)
- Slash commands
- Multi-workspace deployment

### SMS (`sms-adapter.ts`)

SMS gateway integration for mobile messaging. Supports two-way SMS conversations with Carina
via a configured SMS gateway provider (Twilio or compatible). Test coverage: `sms-adapter.test.ts`

### Microsoft Teams (`teams-adapter.ts`)

Connects Carina to Microsoft Teams. Supports:
- Direct messages to the bot
- Channel @mentions
- Teams app installation
- Adaptive Card responses

### Telegram (`telegram-adapter.ts`)

Connects Carina to Telegram via the Bot API. Supports:
- Private chats with the bot
- Group chats with @mention triggering
- Inline keyboard buttons for structured responses
- Audio message reception (fed to transcription tool)
- Document and file reception
- The daily briefing and TTS delivery system uses Telegram as the primary delivery channel

### Web (`web-adapter.ts`)

Connects Carina to a web chat widget. The web adapter powers the embedded chat on `app.carinaai.uk`
and the embeddable widget for partner deployments. Supports:
- Real-time WebSocket communication
- Fallback to HTTP polling
- File upload from the browser
- Session continuity across page refreshes

### WhatsApp (`whatsapp-adapter.ts`)

Connects Carina to WhatsApp Business API. Supports:
- Text message conversations
- Media message reception (images, documents, audio)
- Template message sending
- Business account integration
- Aiva uses WhatsApp as a primary channel for AI employee delivery

Test coverage: `whatsapp-adapter.test.ts`

## Channel Credential Storage

Channel credentials (bot tokens, API keys, webhook secrets, IMAP passwords) are stored in the
channel credential store (`credential-store.ts`), not in environment variables. This allows
multi-tenant deployments where different workspaces use different channel credentials without
restarting the server.

The credential store is backed by the PostgreSQL database with encryption at rest.

## Scout Channel Signals

`channel-scout-signals.ts` integrates the channel layer with Scout monitoring. Every incoming
message and outgoing response generates a Scout signal. Scout uses these signals to:
- Detect anomalous message patterns
- Apply egress filtering to outgoing responses
- Log channel activity to the immutable audit trail
- Trigger alerts on suspicious patterns (e.g., prompt injection attempts via WhatsApp)

## Channel-Agnostic Response Formatting

The message router applies channel-aware formatting before delivery:
- Markdown tables: rendered fully on Discord and Slack; converted to plain text on SMS and
  WhatsApp (which do not render markdown tables)
- Link embeds: suppressed on platforms that auto-embed (to avoid duplicate previews)
- Long responses: split into multiple messages on platforms with character limits (SMS, WhatsApp)
- Code blocks: preserved on Discord and web; simplified on mobile SMS

## Group Chat Behaviour

When deployed in group chats (Discord guilds, Telegram groups, Slack channels), Carina follows
speaking rules:
- Responds when directly @mentioned or asked a question
- Responds when the message is clearly directed at the bot
- Stays silent during human-to-human conversation
- Avoids sending multiple responses to the same message (no triple-tapping)
- Uses emoji reactions as lightweight social signals on platforms that support them

## Future Channel Support

The adapter registry is designed for extension. Adding a new channel requires:
1. Implementing the `ChannelAdapter` interface in a new file under `src/channels/adapters/`
2. Registering the adapter in `adapter-registry.ts`
3. Adding credential storage fields for the new platform

Planned but not yet implemented: Signal, Matrix, iMessage, WeChat, DingTalk, Feishu (native),
Mattermost, Home Assistant (native).
