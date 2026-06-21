# Phase 2.3; Multi-Channel Integration (Discord, Slack, SMS)

## Goal
Extend Carina beyond Telegram to Discord, Slack, and SMS. Each channel gets an adapter that normalizes incoming messages into Carina's internal format and formats outgoing responses for that platform's constraints. This fulfills "Every channel, one agent."

## Files to create
```
packages/engine/src/
  channels/
    channel-adapter.interface.ts; IChannelAdapter interface
    channel-registry.ts; Registry of all channel adapters
    adapters/
      discord-adapter.ts; Discord bot integration
      slack-adapter.ts; Slack app integration
      sms-adapter.ts; SMS via Twilio
      telegram-adapter.ts; REFACTOR: move existing Telegram code here
    channel-formatter.ts; Platform-specific formatting rules
    channel-capabilities.ts; What each channel supports (reactions, embeds, audio, etc.)
```

## IChannelAdapter interface
```typescript
interface IChannelAdapter {
  name: string; // 'discord', 'slack', 'telegram', 'sms'
  
  // Inbound
  parseInbound(raw: any): ChannelMessage; // Normalize incoming message
  validateWebhook(req: Request): boolean; // Verify webhook authenticity
  
  // Outbound  
  sendMessage(target: string, text: string, opts?: SendOptions): Promise<void>;
  sendAudio(target: string, filePath: string, caption?: string): Promise<void>;
  sendFile(target: string, filePath: string, caption?: string): Promise<void>;
  
  // Formatting
  formatForChannel(text: string): string; // Adapt markdown/HTML for platform
  
  // Capabilities
  supportsReactions: boolean; // Discord yes, SMS no
  supportsEmbeds: boolean; // Discord yes, Telegram no
  supportsThreading: boolean; // Slack yes, SMS no
  maxMessageLength: number; // Discord 2000, Telegram 4096, SMS 160
}
```

## Discord adapter
- Uses discord.js library
- Registers slash commands: /chat, /summary, /briefing, /help
- Processes messages from allowed channels/DMs
- Supports embeds for structured data (briefings, reports)
- Supports emoji reactions
- Link suppression: wraps URLs in <> to prevent embeds
- Max message length: 2000 chars (splits longer messages)

## Slack adapter
- Uses Slack Bolt framework
- Socket Mode for local development, HTTP endpoints for production
- Registers slash commands and app mentions
- Thread support: replies in-thread when in a threaded conversation
- Block Kit for structured messages (briefings with sections)
- Max message length: 3000 chars

## SMS adapter
- Uses Twilio API
- Inbound: Twilio webhook → parse message body
- Outbound: Twilio Messages API
- Plain text only, no formatting
- Max message length: 160 chars (concatenated SMS for longer)
- All messages start with "[Carina] " prefix

## Channel registry
```typescript
class ChannelRegistry {
  private adapters: Map<string, IChannelAdapter> = new Map();
  
  register(adapter: IChannelAdapter): void;
  getForInbound(channel: string, raw: any): IChannelAdapter;
  getByName(name: string): IChannelAdapter;
  listActive(): string[];
}
```

## Message normalization
All inbound messages are normalized to:
```typescript
interface ChannelMessage {
  channel: 'discord' | 'slack' | 'telegram' | 'sms';
  chatId: string; // Channel/chat/DM identifier
  userId: string; // Sender identifier  
  text: string; // Message text
  isCommand: boolean; // Is this a /command?
  isMention: boolean; // Was the agent @mentioned?
  isGroupChat: boolean; // Is this a group conversation?
  attachments: Attachment[]; // Files, images, voice notes
  threadId?: string; // Thread identifier (Slack)
  replyToMessageId?: string; // Message being replied to
}
```

## Group chat behavior
In group chats, the agent only responds when:
- Directly @mentioned
- A slash command is used
- The message is in an agent-specific channel (#carina-chat)

Casual banter is ignored. Platform-specific formatting is applied automatically.

## Verification
```bash
# Discord
# Invite bot to server, send @Carina hello
# Expected: response in channel, no response to casual messages

# Slack
# Install app, send /carina summary
# Expected: Block Kit formatted portfolio summary

# SMS
# Send text to Twilio number
# Expected: [Carina] response within 5 seconds
```
