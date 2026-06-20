# IRC Gateway

The IRC adapter in Carina is a **stub**. Carina does not ship a built-in IRC client. The adapter receives inbound messages from a sidecar bot that forwards them over HTTP and can post replies back via the sidecar.

## How it works

```
IRC server
   |
IRC sidecar bot (e.g. Limnoria, Sopel, irssi-script)
   |  POST /webhooks/irc
   v
Carina (IrcAdapter processes the message, sends reply)
   |
   v  HTTP callback to sidecar
IRC sidecar bot -> IRC server
```

## Setup

1. Configure your IRC sidecar bot to:
   - Forward inbound messages to `POST https://your-carina-host/webhooks/irc`
   - Accept outbound HTTP callbacks from Carina and post them to the IRC channel.

2. Add to `.env`:

   ```
   IRC_ENABLED=true
   ```

3. Start Carina. The IRC adapter will register and accept inbound webhooks at `/webhooks/irc`.

## Inbound payload format

```json
{
  "text": "message text",
  "user": "nick",
  "channel": "#channelname",
  "id": "optional-message-id"
}
```

## Limitations

- No built-in IRC protocol client. A sidecar is required.
- Replies from Carina must be delivered by the sidecar. Carina raises an error if no sidecar is configured for outbound delivery.
- IRC does not have persistent sessions; each message uses the channel name as the conversation ID.

## Troubleshooting

| Symptom | Fix |
|---|---|
| IRC adapter not enabled | Set `IRC_ENABLED=true` |
| `IRC adapter is a stub` error | Configure the sidecar to handle outbound messages from Carina |
| Messages not received | Verify the sidecar is posting to `/webhooks/irc` with the correct payload format |
