# WhatsApp Gateway

WhatsApp runs through Twilio. Carina mounts webhook routes on the same Express server as the web gateway.

## Setup

1. Create a [Twilio](https://www.twilio.com) account and enable the WhatsApp sandbox (or an approved sender).
2. Set environment variables:

   ```
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
   ```

3. In the Twilio console, set the inbound webhook URL to:

   ```
   https://your-domain/webhooks/whatsapp
   ```

4. Ensure `WEB_ENABLED` is not `false` and port 443 reaches Carina (via nginx or similar).

## Behaviour

- **No streaming** - The full reply is sent in one WhatsApp message when generation completes.
- **Media** - Images and PDFs from users are saved under `data/uploads/` and paths are available to file tools in the same turn.
- **Commands** - `/help`, `/provider`, `/clear`, and `/memories` follow the same routing as Telegram where implemented.

## Security

- Use HTTPS only for webhooks.
- Twilio signs requests; keep `TWILIO_AUTH_TOKEN` secret.
- WhatsApp user content is scanned by Scout prompt guard when `LABYRINTH_ENABLED=true`.

## Troubleshooting

Startup logs `WhatsApp gateway skipped` when any of the three Twilio variables is missing. All three are required.
