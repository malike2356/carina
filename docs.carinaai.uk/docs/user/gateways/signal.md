# Signal Gateway

Carina connects to Signal via the [signal-cli REST API](https://github.com/bbernhard/signal-cli-rest-api) when `SIGNAL_API_URL` is set.

## Prerequisites

- A registered Signal number or linked device.
- A running instance of `signal-cli-rest-api` (Docker image: `bbernhard/signal-cli-rest-api`).

## Setup

1. Run the signal-cli REST API and register or link your number:

   ```bash
   docker run -p 8080:8080 bbernhard/signal-cli-rest-api
   # Follow the registration flow at http://localhost:8080/v1/register
   ```

2. Add to `.env`:

   ```
   SIGNAL_API_URL=http://localhost:8080
   SIGNAL_API_KEY=          # optional bearer token if the sidecar is secured
   SIGNAL_PHONE_NUMBER=+44...
   ```

3. Configure the sidecar to forward inbound messages to Carina's webhook endpoint:

   ```
   POST https://your-carina-host/webhooks/signal
   ```

4. Start Carina. Send a message to the registered Signal number.

## Behaviour

- **Direct messages only** - Group messaging is not supported.
- **No streaming** - Full reply sent as one Signal message.
- **Commands** - `/help`, `/provider`, `/clear` in message text.
- **Media** - Incoming attachments are saved under `data/uploads/` and passed as file paths to tools.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `SIGNAL_API_URL` | Yes | Base URL of the signal-cli REST API |
| `SIGNAL_PHONE_NUMBER` | Yes | Registered Signal number (e.g. `+441234567890`) |
| `SIGNAL_API_KEY` | No | Bearer token for the sidecar when authentication is enabled |

## Troubleshooting

| Symptom | Fix |
|---|---|
| Signal gateway not starting | Set `SIGNAL_API_URL`; check sidecar is running |
| Messages not received | Verify the sidecar webhook is pointed at Carina's `/webhooks/signal` |
| Phone number rejected | Ensure the number is in E.164 format with country code |
