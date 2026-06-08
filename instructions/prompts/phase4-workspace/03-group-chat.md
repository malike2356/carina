# Phase 4.3 — Group Chat Intelligence + Multi-platform Formatting

## Task
Implement group chat awareness. Carina knows when to speak vs stay silent in group conversations, adapts formatting per platform, and uses emoji reactions appropriately.

## Speaking rules

### When to respond
- Directly mentioned or asked a question
- Can add genuine value (info, insight, help)
- Something witty/funny fits naturally
- Correcting important misinformation
- Summarizing when asked

### When to stay silent
- Casual banter between humans
- Someone already answered the question
- Response would just be "yeah" or "nice"
- Conversation is flowing fine without agent
- Adding a message would interrupt the vibe

### Triple-tap prevention
Do not respond multiple times to the same message with different reactions.
One thoughtful response beats three fragments.

## Platform formatting

### Discord / WhatsApp
- No markdown tables — use bullet lists
- Discord links: wrap in <> to suppress embeds
- WhatsApp: no headers — use bold or CAPS for emphasis

### General
- Adapt message length to platform norms
- Telegram: medium-length, structured
- Discord: shorter, more casual
- SMS: very short, plain text

## Reaction system

### When to react
- Appreciate something without replying (thumbs up, heart)
- Something made you laugh (laugh emoji)
- Something interesting (thinking face)
- Acknowledge without interrupting
- Simple yes/no or approval

### Rules
- One reaction per message maximum
- Pick the one that fits best
- Reactions are lightweight social signals

## Implementation

### Platform detection
Carina must know which platform a message came from:
- telegram, discord, slack, whatsapp, sms, matrix, signal

### Context window
In group chats, include:
- Recent message history (who said what)
- Whether agent was mentioned
- Platform type
- Speaking rules applied as system instructions

### Formatting adapter
Per-platform output formatting:
- Discord: 2000 char limit, embed support, markdown
- Telegram: HTML or MarkdownV2, 4096 char limit
- WhatsApp: plain text, no formatting
- SMS: 160 char segments, plain text

## Verification
```bash
# Group chat test
# Send: "Hey everyone, what's for lunch?"
# Expected: Carina stays silent (casual banter)

# Send: "@Carina what's the status on the Propreneur deploy?"
# Expected: Carina responds (directly mentioned)

# Discord link test
# Carina sends: <https://example.com/report.pdf>
# Expected: Link appears without embed preview
```
