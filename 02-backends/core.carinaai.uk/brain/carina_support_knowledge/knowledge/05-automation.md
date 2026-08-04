# Automation: Cron Jobs, Scheduled Tasks, Webhooks, and Environment

## Cron Jobs

Cron jobs let you run automated tasks on a schedule. Think of them as repeating alarms that tell Carina to do something at a set time, without you having to ask.

### What you can schedule

- A daily summary of your tasks and calendar.
- A weekly research report on a topic you care about.
- A recurring check-in that reviews a document or dataset.
- Any workflow you would otherwise trigger manually.

### Creating a cron job

1. Open "Cron jobs" from the sidebar.
2. Click "New job".
3. Give the job a name and describe what it should do.
4. Set the schedule (every hour, every day at 9am, every Monday, etc.).
5. Save it.

The job will run automatically on the schedule you set. Results are stored in the job history.

### Viewing scheduled jobs

The Cron jobs page lists all your active and paused jobs with their next run time and last result.

### Pausing and deleting jobs

You can pause a job temporarily (it will not run until you resume it) or delete it permanently from the job menu.

---

## Scheduled Tasks

Scheduled is related to Cron jobs but shows the queue of upcoming and recent runs in a timeline view. It is useful for seeing what is about to run and reviewing what ran recently.

Open "Scheduled" from the sidebar to see the timeline.

---

## Webhooks

Webhooks let Carina send a notification to an external service when something happens inside your workspace. This is how you connect Carina to other tools (like Slack, Notion, or a custom application) without writing much code.

### What is a webhook?

A webhook is a URL that Carina calls with a small package of information when a specific event happens. The receiving service (Slack, your app, etc.) then acts on that information.

### Setting up a webhook

1. Open "Webhooks" from the sidebar.
2. Click "New webhook".
3. Give it a name, paste the URL you want Carina to call, and choose which events should trigger it.
4. Save it.

### Events you can watch

Common events include: new chat message sent, research session completed, task status changed, cron job run completed, and file uploaded. The Webhooks page shows the full list of available events.

### Testing a webhook

After saving, click "Test" to send a sample payload to your URL and confirm it is working.

---

## Environment Variables

Environment variables are a way to store configuration values that Carina or your integrations need, without putting them directly into chat messages or job descriptions.

### What they are for

If you are connecting Carina to an external API that requires a secret key, you can store that key as an environment variable rather than typing it into every job. Your jobs and skills can reference the variable by name.

### Setting environment variables

1. Open "Environment" from the sidebar.
2. Click "New variable".
3. Give it a name (for example, NOTION_API_KEY) and enter the value.
4. Save it.

The value is stored securely and can be used in cron jobs, webhooks, and MCP server configurations.

### Viewing variables

Variable names are visible on the Environment page. Values are hidden by default for security.

---

## Common automation questions

**"Can Carina send me a daily briefing?"**
Yes. Create a cron job scheduled for your preferred time (for example, 8am Monday to Friday) and describe what the briefing should cover (tasks due today, calendar events, recent research, etc.).

**"Can I trigger a webhook when a cron job finishes?"**
Yes. When creating or editing a cron job, you can set a webhook URL to call when the job completes. This lets you chain Carina into a wider automation pipeline.

**"How do I pass a secret API key to a cron job?"**
Store it as an environment variable in the Environment section. Then reference it by name in your job description or skill configuration.
