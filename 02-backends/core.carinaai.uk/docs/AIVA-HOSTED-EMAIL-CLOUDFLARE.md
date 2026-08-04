# Aiva Hosted Email With Cloudflare

One-time Cloudflare setup for automatic Aiva email addresses. End users never see this.

## Model

Every Aiva gets an alias like `ama-9f2a1b@inbox.hireaiva.co.uk`. That is not a mailbox. Cloudflare Email Routing receives the whole subdomain and sends each message to a Worker. The Worker posts structured JSON to Carina, then Carina maps the recipient to a worker row in `aiva_hosted_email_addresses`.

You do not create individual Cloudflare addresses per Aiva.

## Core env

```bash
AIVA_HOSTED_EMAIL_ENABLED=true
AIVA_HOSTED_EMAIL_DOMAIN=inbox.hireaiva.co.uk
AIVA_HOSTED_EMAIL_PROVIDER=cloudflare
CLOUDFLARE_EMAIL_WORKER_SECRET=<long-random-secret>
```

`MAILGUN_WEBHOOK_SIGNING_KEY` can stay unset when Cloudflare is the provider.

## Cloudflare setup

1. In Cloudflare, select the domain that owns `inbox.hireaiva.co.uk`.
2. Go to `Compute > Email Service > Email Routing`.
3. Onboard the email domain or subdomain.
4. Let Cloudflare add the MX, SPF, and DKIM records it requires.
5. Create an Email Worker.
6. Add a catch-all routing rule for `*@inbox.hireaiva.co.uk`.
7. Set the catch-all action to the Email Worker.
8. Add a Worker secret named `AIVA_EMAIL_SECRET` with the same value as `CLOUDFLARE_EMAIL_WORKER_SECRET`.
9. Deploy the Worker.

## Worker

Use `postal-mime` so Carina receives text, HTML, and attachment metadata instead of raw MIME.

```ts
import PostalMime from 'postal-mime';

export interface Env {
  AIVA_EMAIL_SECRET: string;
  AIVA_INBOUND_URL: string;
}

export default {
  async email(message, env, ctx): Promise<void> {
    const parser = new PostalMime();
    const parsed = await parser.parse(message.raw);

    const payload = {
      recipient: message.to,
      sender: message.from,
      from: parsed.from?.address ?? message.from,
      subject: parsed.subject ?? '',
      bodyPlain: parsed.text ?? '',
      bodyHtml: parsed.html ?? '',
      messageId: parsed.messageId ?? '',
      attachmentCount: parsed.attachments?.length ?? 0,
      headers: Object.fromEntries(message.headers),
    };

    const response = await fetch(env.AIVA_INBOUND_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-aiva-email-secret': env.AIVA_EMAIL_SECRET,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok && response.status !== 202) {
      message.reject(`Aiva inbound failed: ${response.status}`);
    }
  },
} satisfies ExportedHandler<Env>;
```

Set `AIVA_INBOUND_URL` to one of:

```text
https://admin.hireaiva.co.uk/api/aiva/email/inbound/cloudflare
https://core.carinaai.uk/api/aiva/email/inbound/cloudflare
```

Use the admin URL when you want the hosted app to proxy traffic to core. Use core directly when core is public and stable.

## Backfill

After env is set, backfill old workers:

```bash
pnpm carina aiva-email-addresses backfill
pnpm carina aiva-email-addresses status --json
```

## Test

1. Hire or open an Aiva worker.
2. Copy the email address from the worker detail page.
3. Send a normal email to that address.
4. Confirm it appears in the Email page and creates the expected approval or task.
5. Run `carina doctor` and check `Aiva hosted email`.

## Keep Mailgun

The Mailgun endpoint can remain available as a fallback at:

```text
/api/aiva/email/inbound/mailgun
```

Do not set up both Cloudflare and Mailgun catch-alls for the same subdomain at the same time. Pick one MX receiver for `inbox.hireaiva.co.uk`.
