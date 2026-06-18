# ChatGPT Image Generation Prompt: Carina Launcher Redesign

## How to use this

Paste the prompt below into ChatGPT (GPT-4o with image generation).
Attach the three existing mockup images as reference:
- Carina_launcher.png
- Carina_launcher_side_expanded.png
- Carina_launcher_TUI.png

Also attach the Carina logo reference: carina_10-final.png

---

## THE PROMPT

---

I am redesigning the launcher screen for Carina, an AI agent platform. I have attached the existing mockup designs and the final Carina logo as reference. I want you to generate three improved high-fidelity UI mockup screens based on the corrections and principles below. Do not copy the existing mockups. Use them only as reference for brand colors, the logo mark, and the general dark UI direction. The layout, hierarchy, and content must change significantly.

---

### BRAND IDENTITY (do not change these)

Logo mark: The Carina star/snowflake symbol with 6 arms, rendered in a blue-purple-teal-gold gradient. This is the finalised logo. Do not redesign it.

Wordmark: "Carina" in bold modern sans-serif, white, with the gradient star mark to its left or above.

Tagline: "ONE MEMORY. ONE AGENT. EVERYWHERE." in spaced uppercase, muted grey/white.

Color palette:
- Background (primary): #08091A - very dark navy, almost black
- Surface (cards/panels): #0E1428 with subtle border #1C2640
- Accent (primary): #22D3EE (cyan/teal) - used for the CTA button and active states
- Accent (secondary): #818CF8 (soft violet) - used for highlights and the logo gradient
- Text primary: #E4E8F0
- Text muted: #6B7280
- Success/online: #22C55E (green)
- The CONTINUE WORK button: cyan to teal gradient fill, white text, bold, full-width or prominent
- No red elements on the main launcher unless Scout shows a warning

Typography: Clean modern sans-serif throughout (Inter, Geist, or similar). No decorative fonts. Monospace only in the TUI screen.

No emojis. No em dashes. No decorative icons that are not functional.

---

### THE CORE PROBLEM TO FIX

The existing launcher makes this mistake: it uses the majority of the screen to show system health percentages (Memory: 100%, Models: 100%, Skills: 100%, etc.). This is operator admin content. It is not launcher content.

The launcher has one job: show the user what they were working on and get them back to it in one click.

The rule is: show the work, not the engine.

A user who opens Carina does not care that "40 models are connected at 100%." They care about the Propreneur project they were building yesterday.

The system health can exist but it must be collapsed, minimal, and secondary. A single line at the bottom ("All systems ready. Scout: Active.") is enough. The status percentages panel that dominates the right side of the existing design must be removed or collapsed to a small badge row.

---

### SCREEN 1: Carina Launcher (primary entry screen)

Generate a desktop app window, approximately 1280x800px, dark theme.

Layout:

TOP BAR (full width, slim, ~40px):
- Left: Small Carina star mark (16px) + "CARINA LAUNCHER" in small uppercase muted text
- Right: A single green dot labeled "ONLINE" in small text. Nothing else.

LEFT COLUMN (~40% width):
- Carina logo mark (the star symbol) at ~80px, gradient, centred in the upper portion of this column. Do not use it as an exploded diagram. Use it as a logo.
- Below the mark: "Carina" wordmark, large (40px), white bold.
- Below wordmark: "ONE MEMORY. ONE AGENT. EVERYWHERE." in small spaced uppercase, muted grey.
- Below tagline, a 16px gap, then a greeting in medium text: "Good evening, Laud." No emoji. No exclamation mark. Just the name.
- Below greeting: "3 active projects." in muted text.

RIGHT COLUMN (~60% width):
This is where the work lives.

SECTION HEADER: "PICK UP WHERE YOU LEFT OFF" in small uppercase muted text.

Three project cards stacked vertically, each card:
- Project name in bold white (e.g. "Propreneur", "Carina", "Scout")
- Subtitle in muted text: the workspace type or last action (e.g. "Workspace", "Core Agent", "Dashboard Redesign")
- Right side of card: time ago in small muted text (e.g. "2 min ago", "1 hr ago", "3 days ago")
- A subtle right-arrow (>) on hover state implied
- Cards have a subtle border, dark surface background, no heavy shadows

Below the three cards: small link text "View all projects" with a count badge.

Below that, 32px gap, then the main CTA:

CONTINUE WORK button: Full width of the right column, ~56px tall, cyan to teal gradient background, white bold text "CONTINUE WORK", right-arrow icon on the right side. This is the dominant interactive element on the screen.

BOTTOM BAR (full width, slim, ~32px):
A single row of 4 small status chips, separated by thin dividers:
- "Scout: Protected" (green dot)
- "Encrypted"
- "Synced"
- "v1.0.0"

That is all. No percentage bars. No status panels. No skill counts. No model counts.

The overall impression should be: calm, confident, minimal. The user sees their work and a clear next action. Nothing else competes for attention.

---

### SCREEN 2: Carina Launcher with Left Navigation Expanded

Same as Screen 1, but the left column is now a full sidebar navigation panel (~220px wide), and the Carina logo area compresses to the top of the sidebar.

Sidebar top:
- Carina star mark (24px) + "Carina" wordmark in bold, left-aligned
- Muted subtitle: "Laud's Workspace"

Sidebar navigation items (icon + label, full width, rounded hover state):
- Home (active state, accent color left border)
- Workspaces
- Projects
- Memory
- Skills
- Channels
- Scout
- Settings

Bottom of sidebar:
- Small avatar or initials circle: "L" (for Laud)
- Name: "Laud"
- Muted text: "Owner"

Main content area (right of sidebar, ~75% width):
Same project cards, greeting, and CONTINUE WORK button as Screen 1.

The sidebar should feel like it belongs in a premium desktop app: subtle hover states, clean icons, tight spacing, no heavy borders or gradients on the nav items themselves. The active item has an accent-color left border indicator only.

---

### SCREEN 3: Carina TUI (Terminal User Interface)

This is a pure terminal experience for power users who run `carina` with no arguments and enter the TUI.

Style: Terminal window, black background (#000000 or #0A0A0A). All text is monospaced. Use a real terminal aesthetic: no rounded corners on content, no cards with shadows, no gradients except the Carina logo mark in the top-left corner (the star symbol can render with its gradient even in the TUI as it is SVG-based in real use).

Layout:

TOP ROW (single line):
Left: Gradient Carina star mark (16px) + "CARINA v1.0" in dim white monospace
Center: "ONE MEMORY. ONE AGENT. EVERYWHERE." in dim muted monospace
Right: "User: Laud   Session: #7a2f4e   18:42:21" in muted monospace

A single horizontal rule below this row.

TWO-COLUMN LAYOUT:

LEFT PANEL (~55% width):

Heading: "SYSTEM STATUS" in uppercase monospace, cyan.

Status items (left-aligned, monospace, each on its own line):
  Memory       Synced across 40 channels     [OK]
  Channels     40 / 40 Connected             [OK]
  Models       6 Models Ready                [OK]
  Skills       24 Skills Loaded              [OK]
  Scout        Active, Protected             [OK]
  Workspace    Environment Ready             [OK]

A blank line, then:

SYSTEM HEALTH
All services operational             100%   [========]

A blank line, then:

LAST ACTIVITY
Scout Dashboard Redesign
Project: Scout   Mode: Design   Duration: 42m

A blank line, then:

ACTIVE PROJECTS
  Propreneur      Workspace        2024-06-18 2m ago
  Carina          Core Agent       2024-06-18 1h ago
  Scout           Dashboard Redesign  2024-06-17 3d ago

"View all projects" as small muted text with a count.

RIGHT PANEL (~45% width):

Heading: "QUICK ACTIONS" in uppercase monospace, cyan.

Items formatted as keyboard shortcut + command:
  [C]   Continue Last Session
  [O]   Open Workspace
  [M]   Memory Browser
  [S]   Scout Status
  [K]   Skills Manager
  [/]   Settings
  [?]   Help

A blank line, then:

Heading: "QUICK COMMANDS" in uppercase monospace, cyan.

Small muted text: "Type help for available commands"

Examples shown as dim text:
  carina ask "..."
  carina memory search
  carina scout status
  carina skill install

BOTTOM PROMPT BAR (full width):
A terminal prompt line:
  carina@launcher ~ $

With a blinking cursor implied.

The TUI color scheme:
- Background: #000000
- Primary text: #D4D4D4 (light grey)
- Accent/headings: #22D3EE (cyan) - used only for section headings and [OK] status
- Muted: #6B7280
- Prompt: #22C55E (green)

The TUI should feel like k9s or lazygit: information-dense, zero decoration, every element earns its presence.

---

### WHAT TO AVOID IN ALL THREE SCREENS

Do not include:
- Emojis of any kind
- Percentage bars for individual system components (Memory: 100%, Skills: 100%, etc.) as a dominant visual element
- The Carina star diagram with labeled arms (Memory, Models, Channels, etc.) as an exploded technical map. Use the logo mark as a logo, not as a diagram.
- "What can I help you with?" or any blank-slate chat prompt
- A list of tool names or feature names in the launcher
- Any marketing copy beyond the tagline

The dominant message in all three screens is: "I know what you were doing. Continue?"

---

### DELIVERABLE

Three separate mockup images, each at approximately 1280x800px (or 16:10 ratio), high fidelity, ready for developer handoff. Dark theme throughout. The overall visual language should feel like a premium developer tool that a non-technical business owner could also be comfortable using.
