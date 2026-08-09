# Troubleshooting - Common Problems and Fixes

## Chat and Messaging

### "Carina is not responding / the chat is blank"

Cause 1 - No API key. You need to add at least one API key before Carina can reply.
Fix: Go to Settings, then "API keys", and add a key from Anthropic, OpenAI, or another supported provider.

Cause 2 - The API key is expired or invalid.
Fix: Go to Settings, then "API keys". Delete the existing key and add a fresh one from your provider's dashboard.

Cause 3 - Your daily or monthly token quota is exhausted.
Fix: Check your usage on the Billing page. If you are on the Free plan, your limit resets at midnight UTC. If you are on Starter, your monthly limit may be reached; upgrade to Team for unlimited tokens.

---

### "I get an error that says something like 'quota exceeded' or 'token limit reached'"

This means you have used all the tokens available on your current plan for the period.

- Free plan: resets daily at midnight UTC. Wait until tomorrow, or upgrade to Starter.
- Starter plan: resets monthly. Wait until the start of next month, or upgrade to Team for unlimited tokens.
- Team plan: unlimited. If you see this error on Team, contact support.

---

### "Carina's responses are getting cut off mid-sentence"

This is usually caused by hitting a token limit within a single response (the AI model has a maximum output length). Try:

- Asking Carina to "continue" in your next message.
- Breaking your question into smaller parts.
- Switching to a model with a higher output limit (check your API keys page for available models).

---

### "My conversation history is gone"

If you cleared your browser data (cookies, local storage) recently, the session list may appear empty for a moment while it reloads. Refresh the page.

If sessions are genuinely missing, contact support at support@carinaai.uk with your account email and the approximate date of the missing sessions.

---

### "Carina is not remembering things I told her before"

Check two things:

1. On the Settings page, confirm that "Auto-extract memories" and "Inject memories in chat" are both turned on (under Brain settings).
2. Open the Memory panel and search for what you expected her to remember. If it is not there, it may not have been extracted yet. Try adding it manually using the "Add memory" button.

---

## API Keys

### "My API key is not working"

Common causes:

- The key is from the wrong provider. Make sure the provider selected in Carina matches the type of key (Anthropic keys only work with Anthropic models, etc.).
- The key has no billing set up on the provider's side. Keys from providers like Anthropic or OpenAI require an active billing method on your provider account, not just the key itself.
- The key has been revoked. Go to your provider's dashboard and check that the key is still active.

Fix: On the API keys page, use the "Test" option next to the key. It will tell you whether the key is valid.

---

### "I do not know where to get an API key"

- Anthropic (Claude models): Go to console.anthropic.com, create an account, and generate an API key from the API keys section.
- OpenAI (GPT models): Go to platform.openai.com, create an account, and find API keys in your account settings.
- Other providers: Each provider has their own console. The API keys page in Carina lists the supported providers with links.

---

## Memory

### "A memory is wrong and I cannot edit it"

Open the Memory panel. Find the memory and click the edit (pencil) icon. Make your change and save.

If the edit option is not visible, try scrolling to the right in the memory row or clicking the three-dot menu.

---

### "Carina keeps learning something I do not want her to remember"

Open the Memory panel, find the unwanted memory, and delete it. If she keeps re-extracting it, also turn off "Auto-extract memories" temporarily in Settings (Brain section), or manually disable the memory (toggle it off without deleting).

---

## Calendar

### "My Google Calendar events are not showing in Carina"

1. Go to Settings, then "Calendar sync".
2. Check that your Google account is still connected. If the connection shows an error, disconnect and reconnect.
3. After reconnecting, click "Sync now" (if available) or wait a few minutes for the next automatic sync.

If events still do not appear after reconnecting, check that you granted Carina permission to read your calendar during the Google authorisation step.

---

## Cron Jobs and Automation

### "My cron job is not running"

Check:

1. The job is not paused. On the Cron jobs page, confirm the job status shows "Active" not "Paused".
2. The schedule is set correctly. Times are in UTC. If you set a job for "9am" but expected local time, it may be running at a different time.
3. The last run did not error. Click the job to see its run history and check if the most recent run shows an error.

---

### "My webhook is not receiving events from Carina"

1. On the Webhooks page, click "Test" on the webhook. This sends a test event to your URL and shows whether it succeeded.
2. Check that the URL is correct and the receiving service is online.
3. Check that the events you selected on the webhook match what actually happened (for example, if you only subscribed to "task completed" events, a "new message" event will not be sent).

---

## Scout

### "Scout is not showing Carina's activity in the dashboard"

Check the pairing is active:

1. In Carina, open "Security" from the sidebar.
2. Look for "Scout pairing" at the bottom of the page.
3. If it shows "Scout connected", the pairing is active. If it shows a form, the pairing has been lost; re-enter your Scout console URL and API key.

Also check your Scout subscription is still active by logging in at console.labyrinthscout.com.

---

### "I triggered the kill switch but Carina is still running"

The kill switch sends a signal to Carina; it does not force-close your browser tab. Carina's agent mode should stop processing when it receives the signal. If you are in a standard chat (not agent mode), the kill switch has no effect on your current message.

If an agent session appears to continue after triggering the kill switch, close the browser tab for that session and contact support.

---

### "I am not receiving Scout alerts"

1. In your Scout dashboard, go to Alert settings and confirm your Telegram username, email, or Slack webhook is saved.
2. For Telegram: confirm you have started a conversation with the Scout bot (you must message it first before it can message you).
3. For email: check your spam folder.
4. For Slack: confirm the webhook URL is still active in your Slack workspace settings.

---

## Account and Billing

### "I cannot log in"

Try resetting your password using the "Forgot password" link on the login page at app.carinaai.uk/login.

If you still cannot log in after resetting, email support@carinaai.uk with your account email address.

---

### "I was charged but my plan did not upgrade"

Email support@carinaai.uk with your account email and the payment reference from your Stripe receipt. Include the subject line: "Billing - plan not upgraded after payment."

---

### "How do I cancel my subscription?"

Go to the Billing page. For cancellations or downgrades, email support@carinaai.uk. Include the subject line: "Billing - cancellation request."

---

## Keprix sibling products (Propreneur Soft Wall, workspace UI)

Carina and Keprix are separate products. If the user is on **Keprix** (`app.keprixai.com`) rather than Carina:

- Dead sidebar or tab clicks: hard-refresh; Keprix uses plain anchors after the MUI+Next soft-nav fix. See Keprix docs Troubleshooting → UI navigation.
- Outreach Soft Wall approvals: `/outreach/approvals` on Keprix (not Carina OPS).
- Propreneur calling Keprix as sidecar: shared token, fail-closed actor IDs, Contabo loopback `http://127.0.0.1:13333`. Point operators to Keprix `docs/propreneur-sidecar/` and `docs/troubleshooting/propreneur-sidecar.md`.
- Do not fold Clinicom Contabo issues into Carina OPS unless the live profile is Carina (default today).
