# Response Templates - Ready-to-Use Replies for Common Tickets

These are word-for-word replies for the most frequent support scenarios. Carina (in support mode) should adapt the tone to match the user, but the facts must stay the same.

---

## Getting started

### "How do I get started with Carina?"

Reply:
"Welcome. To get started, you need to create an account at app.carinaai.uk and then add an API key. The API key lets Carina connect to an AI model on your behalf. You can get one from Anthropic (console.anthropic.com) or OpenAI (platform.openai.com). Once the key is added in Settings, you can start chatting right away. Is there a particular part you would like help with?"

---

### "What is BYOK and why do I need it?"

Reply:
"BYOK stands for bring your own key. It means you supply the API key from an AI provider like Anthropic or OpenAI, and Carina uses it to process your messages. The reason we do it this way is that it gives you direct control over which AI models you use and what you pay the provider. Carina itself does not add a markup on top. Your plan price covers access to the Carina workspace; the AI usage is billed directly by your provider to you."

---

## Plans and billing

### "What is the difference between the plans?"

Reply:
"There are three plans. Free costs nothing and gives you 50,000 tokens per day, which is enough for light daily use. Starter is GBP 19 per month and gives you 500,000 tokens per month, which is enough for regular professional use. Team is GBP 79 per month and gives you unlimited tokens, plus the option to connect Labyrinth Scout for AI security monitoring. All plans require you to bring your own API key from an AI provider. Would you like help choosing the right plan for your situation?"

---

### "I have hit my token limit. What should I do?"

Reply:
"On the Free plan, your token allowance resets every day at midnight UTC. If you can wait until then, you will be able to continue at no cost. If you need more capacity right now, you can upgrade to the Starter plan (GBP 19/month) from the Billing page, which gives you 500,000 tokens per month. For unlimited tokens with no cap, the Team plan is GBP 79/month."

---

### "Can I get a refund?"

Reply:
"For billing disputes and refund requests, our support team handles those directly. Please email support@carinaai.uk with the subject line: Billing - refund request. Include your account email and the payment reference from your Stripe receipt. Someone will get back to you within one business day."

---

## Memory

### "How do I make Carina remember something?"

Reply:
"There are two ways. The first is to just tell Carina in chat, for example: 'Remember that I prefer short answers' or 'I am a property investor based in Leeds.' She will pick it up and save it automatically. The second way is to open the Memory panel from the sidebar, click 'Add memory', and type it in directly. Both work equally well."

---

### "How do I stop Carina from saving things I said?"

Reply:
"You can turn off automatic memory extraction in Settings under the Brain section. Toggle off 'Auto-extract memories' and Carina will stop saving new memories from conversations. Your existing memories stay in place unless you delete them. You can also delete individual memories from the Memory panel at any time."

---

## Scout

### "What is Labyrinth Scout?"

Reply:
"Labyrinth Scout is a separate security monitoring service for AI agents. It watches what your AI agent does in real time, detects suspicious behaviour (like prompt injection attacks), and lets you stop the agent instantly if something goes wrong. Scout is useful if you run AI agents that take real-world actions like sending emails, calling APIs, or browsing the web. If you only use Carina for chat, you probably do not need it. Scout has its own plans starting at GBP 49 per month and can be paired with Carina if you are on the Team plan."

---

### "How do I connect Scout to Carina?"

Reply:
"To connect Scout to Carina, you need to be on the Carina Team plan and have an active Scout account. Once you have both, go to the Security page in Carina's sidebar, scroll down to Scout pairing, and enter your Scout console URL and API key. Click Pair Scout, and Carina's activity will start appearing in your Scout dashboard automatically."

---

### "Can I use Scout with agents other than Carina?"

Reply:
"Yes. Scout is designed to work with any AI agent. Any agent that can send events via the Scout API can be monitored. This includes agents built with popular frameworks like LangChain, CrewAI, and OpenAI Assistants. The Scout documentation at console.labyrinthscout.com has setup guides for different agent types."

---

## Technical features

### "What are MCP servers?"

Reply:
"MCP stands for Model Context Protocol. It is a way to connect Carina to external tools and services so she can take real-world actions during conversations. For example, with the right MCP connection, Carina could read files from a connected system, search a database, or call an external API. You set up MCP connections on the MCP Servers page in the sidebar. There are pre-built community MCP servers you can connect to without writing code, and developers can also build custom ones."

---

### "What are cron jobs in Carina?"

Reply:
"Cron jobs are automated tasks that run on a schedule without you having to trigger them. For example, you could set up a cron job that sends you a summary of your calendar and open tasks every morning at 8am, or a weekly research report on a topic you choose. You create and manage them from the Cron jobs page in the sidebar. Each job has a name, a description of what it should do, and a schedule."

---

### "What is the Terminal for?"

Reply:
"Terminal is a command-line window built into your Carina workspace. It runs in a sandboxed environment, meaning commands you run here are isolated and cannot affect your local machine. You can use it to run scripts, check outputs, and let Carina run commands on your behalf when using agent mode. It is mainly useful for developers and technical users."

---

## Escalation

### When to escalate (send to support team)

Use this reply when the issue requires a human:

"This is something our support team will need to look into for you. Please email support@carinaai.uk with the subject line: [one-line description of the issue]. Include your account email and any relevant details. Someone will get back to you within one business day."

Issues that always need escalation:
- Account deletion requests.
- Data export requests.
- Billing disputes and refund requests.
- Suspected security breach or unauthorised account access.
- Missing account data that cannot be found from within the workspace.
- Anything requiring account-level changes the user cannot make from the Billing or Settings page.
