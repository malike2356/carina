# PROMPT 03: Carina TUI (Terminal User Interface)
# Attach when sending: carina_10-final.png (logo reference — needed for the star mark in the header)

---

Generate a single high-fidelity UI mockup of a terminal application window.
This is the Carina TUI — the terminal dashboard that opens when a power user runs `carina` with no arguments.
Output size: 1280 x 800px. Single image only.

This is a terminal window but it is also a branded product. The Carina star mark logo appears as a real graphic element in the top-left corner (see attached reference). Everything else inside the content area is monospace text, Unicode box-drawing characters, and Unicode symbol characters. No GUI cards, no gradient buttons, no rounded elements.

The visual interest in this design comes from: the gradient logo mark in the header, cyan section headers, ASCII/Unicode decorative bullet characters, progress bar characters, and status indicators. These create a premium terminal experience — like btop, k9s, or Warp — without using any emojis.

---

## CRITICAL RULE: ABSOLUTELY NO EMOJIS

There are zero emoji characters anywhere in this design. Not a single one.
Emojis include: face characters, hand gestures, symbols like ✅ ⚠️ 🔒 💡 ⭐ 🔥 ✨ 🚀 — none of these.

The decorative characters allowed are: Unicode box-drawing characters, Unicode block elements, Unicode geometric shapes, and Unicode arrows. These are monospace-safe and are NOT emojis. The list of allowed decorative characters is specified below.

---

## WINDOW CHROME

macOS-style terminal window frame. Title bar approximately 32px tall, very dark (#060606).
Left side of title bar: the three traffic light circles (red #FF5F57, yellow #FEBC2E, green #28C840) at standard macOS size and spacing.
The title bar is otherwise empty. No text in the title bar.

Window area (below title bar): solid background color #0A0A0A (near-black, slightly warm dark).

---

## FONT

Everything inside the terminal content area uses a monospace font (JetBrains Mono, Fira Code, or SF Mono). Font size: 13px. Line height: 1.6.

Exception: the Carina star mark logo in the header is a graphic element (not text), rendered from the attached carina_10-final.png reference. It sits beside the monospace text in the top bar. This is the ONLY non-text, non-monospace element in the entire design.

---

## ALLOWED DECORATIVE CHARACTERS (Unicode, NOT emojis)

These characters may be used throughout the design as bullets, status indicators, and decorators:

Progress bars: █ ▓ ▒ ░ (block fill characters)
Section rules: ─ (box-drawing horizontal line, repeated to fill width)
Vertical separator: │ (box-drawing vertical line)
Corner characters: ┌ ┐ └ ┘ ├ ┤ (for bordered panels if needed)
Bullets: ▸ ● ◆ ◉ ▪ › (geometric shapes, not emoji)
Arrows: → ► ▸ (pointing right, for navigation)
Status dot: ● (filled circle — used for online/active indicators)
Active indicator: ▸ (right-pointing triangle — used in front of the selected/active item)

These are the ONLY decorative characters permitted. No emoji. No special symbols outside this list.

---

## TOP HEADER AREA

The header occupies the full width of the terminal content area and is approximately 3 lines tall.

LINE 1 (the main header line):

LEFT SIDE: The Carina 6-arm snowflake/star mark graphic at exactly 28px x 28px. This is rendered from the attached carina_10-final.png reference. It is the gradient star symbol with 6 arms, colored dots at the tips, and a glowing cyan center. It appears as a crisp, small version of the full logo. It sits at the very left edge of the header, vertically centered on this line.

Immediately to the right of the star mark, with 10px gap: the text "CARINA v1.0" in bold monospace, white (#D4D4D4), 14px.

CENTER (horizontally centered across the full terminal width): "ONE MEMORY. ONE AGENT. EVERYWHERE." in muted grey (#5A6475), 13px monospace, letter-spaced.

RIGHT SIDE (right-aligned, 16px right padding): "User: Laud     Session: #7a2f4e     18:42:21" in muted grey (#5A6475), 13px monospace. Multiple spaces between the three items — no pipes or dividers.

LINE 2: A full-width horizontal rule made entirely of the "─" character repeated, in muted grey (#2E3540). This rule spans the complete width of the terminal content area.

LINE 3: blank / spacing line.

---

## BODY: TWO-COLUMN LAYOUT

Below line 3 of the header: the body divides into two columns.
Left column: approximately 55% of terminal width. Starts with 2 characters of left padding.
Right column: the remaining 45%. Starts approximately at the 56% mark.
No visible divider between the columns. Separation is implied by whitespace only.

---

## LEFT COLUMN CONTENT

All text: monospace, 13px, left-aligned.

---

### SECTION: SYSTEM STATUS

Section header: "─── SYSTEM STATUS" in cyan (#22D3EE), bold monospace.
(The "───" is three "─" box-drawing characters before the title — a decorative prefix, not a rule. Use them consistently on all section headers in the left column.)

Below the header: 6 data rows. Three fixed-width columns per row:
- Column A: service name — white (#D4D4D4), padded to fixed width
- Column B: status description — muted grey (#9CA3AF), padded to fixed width
- Column C: status indicator — "[OK]" in cyan (#22D3EE), right-aligned to the left panel boundary

Prefix each row with "  ▸ " (2 spaces, then the ▸ character in muted grey #4A5568, then a space) before the service name. This ▸ acts as a monospace bullet point.

  ▸ Memory      Synced across 40 channels       [OK]
  ▸ Channels    40 / 40 Connected                [OK]
  ▸ Models      6 Models Ready                   [OK]
  ▸ Skills      24 Skills Loaded                 [OK]
  ▸ Scout       Active, Protected                 [OK]
  ▸ Workspace   Environment Ready                 [OK]

One blank line after the rows.

---

### SECTION: SYSTEM HEALTH

Section header: "─── SYSTEM HEALTH" in cyan (#22D3EE), bold.

One data line:
"  ▸ All services operational" in white (#D4D4D4), then tab spacing to align, then "100%" in white, then a space, then a filled progress bar.

Progress bar format: "[" in muted grey, then 10 "█" characters in cyan (#22D3EE), then "]" in muted grey. Like this:
[██████████]

This bar represents 100% full — all 10 blocks are filled with "█" in cyan. No empty blocks.

One blank line after.

---

### SECTION: LAST ACTIVITY

Section header: "─── LAST ACTIVITY" in cyan (#22D3EE), bold.

Two content lines:
Line 1: "  ▸ Scout Dashboard Redesign" in white (#D4D4D4).
Line 2: "    Project: Scout    Mode: Design    Duration: 42m" in muted grey (#9CA3AF). The "    " at the start is 4 spaces of indent (aligning under the text of line 1, past the ▸ bullet). Multiple spaces between the three items.

One blank line after.

---

### SECTION: ACTIVE PROJECTS

Section header: "─── ACTIVE PROJECTS" in cyan (#22D3EE), bold.

Three data rows. Fixed-width columns, prefixed with "  ▸ " bullet:

  ▸ Propreneur    Workspace           2024-06-18    2m ago
  ▸ Carina        Core Agent          2024-06-18    1h ago
  ▸ Scout         Dashboard Redesign  2024-06-17    3d ago

Column A (project name): white (#D4D4D4)
Column B (project type): muted grey (#9CA3AF)
Column C (date): muted grey (#9CA3AF)
Column D (time ago): muted grey (#9CA3AF)

One blank line, then:
"  › View all projects (12)" in cyan (#22D3EE). The "›" character is the bullet prefix here (a single right angle quotation — Unicode › — not an emoji). This indicates a navigable link item.

---

## RIGHT COLUMN CONTENT

All text: monospace, 13px, left-aligned to the right column's starting position.

---

### SECTION: QUICK ACTIONS

Section header: "─── QUICK ACTIONS" in cyan (#22D3EE), bold.

Seven rows. Each row:
- Column A: keyboard shortcut in square brackets "[X]" — white (#D4D4D4), monospace, fixed width
- 4 spaces
- Column B: action description — muted grey (#9CA3AF)

[C]    Continue Last Session
[O]    Open Workspace
[M]    Memory Browser
[S]    Scout Status
[K]    Skills Manager
[/]    Settings
[?]    Help

For the currently relevant action (Continue Last Session), prefix the "[C]" with "● " (a filled circle in green #22C55E, then a space) to indicate it is the default/recommended action. All other rows have no prefix (just standard indent alignment).

● [C]    Continue Last Session
  [O]    Open Workspace
  [M]    Memory Browser
  [S]    Scout Status
  [K]    Skills Manager
  [/]    Settings
  [?]    Help

One blank line after.

---

### SECTION: QUICK COMMANDS

Section header: "─── QUICK COMMANDS" in cyan (#22D3EE), bold.

Instruction line: "  Type help for available commands" in italic if the font supports it, otherwise just dim grey (#5A6475).

One blank line, then four command example lines. Each line prefixed with "  $ " (the dollar sign as a terminal prompt indicator — in muted grey #4A5568 — followed by a space) then the command in dim grey (#4A5568):

  $ carina ask "..."
  $ carina memory search
  $ carina scout status
  $ carina skill install

---

## BOTTOM PROMPT LINE

A full-width horizontal rule of "─" characters in muted grey (#2E3540), identical to the header rule.

Below the rule: the terminal prompt line.

"● carina@launcher ~ $" where:
- "●" is a filled circle in green (#22C55E), 13px — the online/active status indicator
- " carina@launcher ~ $" is in green (#22C55E), monospace
- Followed immediately by "█" (a solid block cursor character) in green (#22C55E)

This entire prompt line is rendered in green (#22C55E). It is the only line in the design that uses green (except the ● prefix on the QUICK ACTIONS first item).

---

## COLOR SUMMARY

Background: #0A0A0A
Window title bar: #060606
Primary text: #D4D4D4
Secondary/muted text: #9CA3AF
Dim text: #5A6475 and #4A5568
Section headers (cyan): #22D3EE
[OK] indicators (cyan): #22D3EE
Progress bar blocks (cyan): #22D3EE
Navigation links (cyan): #22D3EE
▸ bullet characters: #4A5568 (very dim — they are structural, not decorative highlights)
● active indicator on QUICK ACTIONS first item: #22C55E (green)
Terminal prompt line: #22C55E (green)
Horizontal rules (─): #2E3540
Logo mark: gradient as in carina_10-final.png reference

No red. No purple. No orange. No yellow. No background panels in any color other than the base background. No gradients on any text or background area except the logo mark itself.

---

## WHAT NOT TO INCLUDE

Strictly excluded:
- Any emoji character of any kind. This includes: ✅ ⚠️ 🔒 💡 ⭐ 🔥 ✨ 🚀 👋 and every other emoji. If a character can be rendered as a colored emoji by the operating system, do not use it.
- GUI elements: no rounded buttons, no card shadows, no border-radius panels, no dropdown menus
- Any sans-serif or display font in the content area (only the logo graphic is non-monospace)
- Background color panels or highlight blocks behind any text
- Column divider lines between the two body columns
- Percentage rings, donut charts, or any graphical progress element other than the "█" block bar described above
- Any content not specified in this prompt
- Any color not in the color summary above

---

## FINAL SPEC

Single image. 1280 x 800px. The terminal window fills the image with approximately 8px of neutral outer background showing the window drop shadow. The Carina gradient star mark in the top-left header is the single most visually striking element — it gives the terminal its identity without breaking the terminal aesthetic. All other visual interest comes from cyan section headers, ▸ bullets, the [OK] and [█] characters, and the green prompt line. The impression is: precise, authoritative, unmistakably Carina.
