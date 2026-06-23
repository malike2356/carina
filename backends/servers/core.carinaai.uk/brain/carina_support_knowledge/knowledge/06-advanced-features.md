# Advanced Features: MCP Servers, Terminal, Profiles, Library, Skill Packs

## MCP Servers

MCP stands for Model Context Protocol. It is a standard way to connect Carina to external tools and services so she can take real-world actions during conversations.

### What MCP servers let Carina do

With an MCP connection, Carina can:

- Read and write files on a connected system.
- Run searches in a database or knowledge base.
- Call external APIs.
- Interact with services like GitHub, Notion, or your own custom tools.

The specific capabilities depend on which MCP server you connect and what it exposes.

### Adding an MCP server

1. Open "MCP servers" from the sidebar.
2. Click "New connection".
3. Enter the URL of the MCP server and any required credentials.
4. Test the connection and save.

Once connected, the tools provided by that server become available to Carina during conversations and in agent mode.

### Do I need technical knowledge to use MCP?

For pre-built MCP servers (there is a library of community ones), no. You just paste the URL and credentials. For building your own MCP server, some development knowledge is needed.

---

## Terminal

Terminal is a sandboxed command-line environment inside your Carina workspace. It lets you run shell commands directly in the browser.

### What you can use it for

- Running scripts.
- Checking output from tools.
- Executing one-off commands without leaving Carina.
- Letting Carina run commands on your behalf when in agent mode.

### Accessing the terminal

Click "Terminal" in the left sidebar. The terminal opens as a floating window.

### Security

The terminal runs in a sandboxed environment that is isolated from your other systems. Commands run here do not have access to your local machine or other workspaces.

### Who can access the terminal?

Terminal access is controlled by your workspace settings. On most plans, the workspace owner can enable or restrict terminal access for the workspace.

---

## Profiles

Profiles let you create different versions of Carina for different purposes. Each profile has its own system prompt, persona, and default behaviour.

### Examples of profiles

- A "Research Assistant" profile that always produces structured reports.
- A "Customer Support" profile that uses a formal tone and specific company information.
- A "Coding Assistant" profile focused on technical accuracy.
- A "Daily Briefing" profile that sets context for morning planning sessions.

### Creating a profile

1. Open "Profiles" from the sidebar.
2. Click "New profile".
3. Give it a name and write a system prompt describing how Carina should behave under this profile.
4. Choose a default AI model and provider for this profile, if you want to override the workspace default.
5. Save it.

### Switching profiles

You can switch profiles at the start of any chat session using the profile selector in the chat interface.

---

## Library

Library is your conversation history viewer. It shows all your past chat sessions in one place, organised into active, pinned, and archived groups.

### What Library shows

- All your past and current chat sessions.
- Each session with a title, timestamp, and preview of the last message.
- Pinned sessions at the top for quick access to ongoing projects.
- Archived sessions for conversations you want to keep but not clutter your main view.

### Using Library

Open "Library" from the sidebar to browse your conversation history. You can:

- Search across all past sessions by keyword.
- Pin a session to keep it prominent.
- Archive a session to move it out of the active list without deleting it.
- Open any session to continue the conversation.

### Difference between Library and the sidebar chat list

The sidebar chat list shows your recent sessions. Library shows the full history including archived ones, and gives you better filtering and search across everything.

---

## Skill Packs

Skill Packs are pre-built bundles of skills, knowledge, and behaviours grouped by industry or use case. They are the fastest way to make Carina expert in a specific area.

### Available skill packs

Packs are listed on the Skill Packs page (accessible from "Packs" in the sidebar). Categories include:

- Property and real estate.
- Finance and accounting.
- Legal.
- Healthcare.
- Logistics.
- Creative and media.
- Construction.
- Manufacturing.
- Agriculture.
- Hospitality.
- Education.
- Energy.

### Installing a skill pack

1. Open "Packs" from the sidebar.
2. Browse or search for the pack you want.
3. Click "Install". The pack's skills and knowledge are added to your workspace immediately.

### Custom packs

If you are a developer or an organisation with specific needs, you can build your own skill pack and install it into your workspace (or distribute it to others if you have a hub account).

---

## Analytics

Analytics shows how your workspace is being used:

- Total tokens consumed over time.
- Usage by model and provider.
- Number of chat sessions per day or week.
- Most active features.

Open "Analytics" from the sidebar to see your usage dashboard.

---

## Logs

Logs shows a stream of activity across your workspace, including audit events (who did what and when). This is useful for:

- Debugging automation issues.
- Reviewing what Carina did during an agent session.
- Auditing workspace activity if you share a workspace with others.

Open "Logs" from the sidebar to see the log stream.
