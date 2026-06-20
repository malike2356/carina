# PROMPT 03: Carina TUI (Terminal User Interface)
# Attach when sending: carina_10-final.png (logo reference for star mark in the header)

---

Generate a single high-fidelity UI mockup of a terminal application window.
This is the Carina TUI, the terminal dashboard that opens when a power user types `carina` with no arguments.
Output size: 1280 x 800px. Single image only.

This is a terminal window and a branded product. The Carina star mark logo appears as a real graphic element in the top-left header. Everything else is monospace text and Unicode box-drawing or block characters. No GUI cards, no gradient buttons, no rounded panels anywhere in the content area.

---

## CRITICAL RULE: NO EMOJIS

Zero emoji characters anywhere in this design. This means: no check mark symbols, no warning triangles, no lock symbols, no star glyphs, no fire glyphs, no sparkle glyphs, no rocket glyphs, no face or hand characters. None of those. If a character renders as a colored pictogram on any operating system, exclude it.

The only decorative characters permitted are the plain Unicode box-drawing and block-element characters listed in the ALLOWED CHARACTERS section below.

---

## WINDOW CHROME

macOS-style terminal window frame. Title bar approximately 32px tall, very dark (#060606).
Left side of title bar: the three traffic light circles (red #FF5F57, yellow #FEBC2E, green #28C840) at standard macOS size and spacing.
Title bar is otherwise empty. No text in the title bar.

Window content background: solid #0A0A0A (near-black, slightly warm).

---

## FONT

Everything inside the terminal content area uses a monospace font (JetBrains Mono, Fira Code, or SF Mono). Font size: 13px. Line height: 1.6.

The Carina star mark in the header is the only non-text graphic element. All other visual interest comes from Unicode characters, color, and column alignment.

---

## ALLOWED CHARACTERS (Unicode, not emojis)

Progress bars: the four block-fill characters (full block, dark shade, medium shade, light shade)
Section rules: the box-drawing horizontal line character, repeated to fill width
Vertical separator: the box-drawing vertical line character
Corner characters: box-drawing corners and T-junctions for bordered panels if needed
Bullets: right-pointing triangle (▸), filled circle (●), filled diamond (◆), bullseye (◉), small square (▪), single right angle (›)
Arrows: right arrow (→), right-pointing filled triangle (►)

These are the only decorative characters permitted.

---

## TOP HEADER

The header spans the full terminal width and is approximately 3 lines tall.

LINE 1:
Left: The Carina 6-arm gradient star mark at 28 x 28px, rendered from the attached carina_10-final.png. It sits at the left edge, vertically centered. This is the only graphic element in the entire design.
Immediately right of the star mark, 10px gap: "CARINA v1.0" in bold monospace white (#D4D4D4), 14px.
Center (horizontally centered across full width): "ONE MEMORY. ONE AGENT. EVERYWHERE." in muted grey (#5A6475), 13px, letter-spaced.
Right (right-aligned, 16px padding): "User: Laud     Session: #7a2f4e     18:42:21" in muted grey (#5A6475), 13px. Multiple spaces between items, no pipe characters.

LINE 2: Full-width horizontal rule made of the box-drawing horizontal line character, in very dark grey (#2E3540), spanning the complete terminal width.

LINE 3: Blank spacing line.

---

## BODY: TWO-COLUMN LAYOUT

Below the header: left column approximately 55% of terminal width (with 2 characters left padding), right column the remaining 45%.
No visible divider between columns. Separation is implied by whitespace only.

---

## LEFT COLUMN

All text: monospace, 13px, left-aligned.

### SYSTEM STATUS

Section header: "─── SYSTEM STATUS" in cyan (#22D3EE), bold. The "───" prefix is three box-drawing horizontal line characters used as a decorative prefix on every left-column section header.

6 data rows, each prefixed with "  ▸ " (2 spaces, right-pointing triangle in dim grey #4A5568, 1 space). Three columns per row: service name in white (#D4D4D4), status description in muted grey (#9CA3AF), and "[OK]" in cyan (#22D3EE) right-aligned to the left panel boundary.

  ▸ Memory      Synced across 40 channels       [OK]
  ▸ Channels    40 / 40 Connected               [OK]
  ▸ Models      6 Models Ready                  [OK]
  ▸ Skills      24 Skills Loaded                [OK]
  ▸ Scout       Active, Protected               [OK]
  ▸ Workspace   Environment Ready               [OK]

One blank line after.

### SYSTEM HEALTH

Section header: "─── SYSTEM HEALTH" in cyan (#22D3EE), bold.

One data line: "  ▸ All services operational" in white (#D4D4D4), then tab spacing, then "100%" in white, then a space, then a progress bar. Progress bar format: "[" in muted grey, then 10 full-block characters in cyan (#22D3EE), then "]" in muted grey. All 10 blocks are filled: [██████████]

One blank line after.

### LAST ACTIVITY

Section header: "─── LAST ACTIVITY" in cyan (#22D3EE), bold.

Line 1: "  ▸ Scout Dashboard Redesign" in white (#D4D4D4).
Line 2: "    Project: Scout    Mode: Design    Duration: 42m" in muted grey (#9CA3AF). 4 spaces indent, multiple spaces between items.

One blank line after.

### ACTIVE PROJECTS

Section header: "─── ACTIVE PROJECTS" in cyan (#22D3EE), bold.

3 data rows prefixed with "  ▸ ", four columns: project name in white (#D4D4D4), project type in muted grey, date in muted grey, time-ago in muted grey:

  ▸ Propreneur    Workspace           2024-06-18    2m ago
  ▸ Carina        Core Agent          2024-06-18    1h ago
  ▸ Scout         Dashboard Redesign  2024-06-17    3d ago

One blank line, then: "  › View all projects (12)" in cyan (#22D3EE). The "›" is the single right-angle character (not an emoji).

---

## RIGHT COLUMN

All text: monospace, 13px, left-aligned to the right column start position.

### QUICK ACTIONS

Section header: "─── QUICK ACTIONS" in cyan (#22D3EE), bold.

7 rows. Each row: keyboard shortcut in brackets "[X]" in white (#D4D4D4), 4 spaces, then action description in muted grey (#9CA3AF).

The first item (Continue Last Session) is the active/default action. Prefix its "[C]" with "● " (filled circle in green #22C55E, then a space). All other rows have standard indent alignment only.

● [C]    Continue Last Session
  [O]    Open Workspace
  [M]    Memory Browser
  [S]    Scout Status
  [K]    Skills Manager
  [/]    Settings
  [?]    Help

One blank line after.

### QUICK COMMANDS

Section header: "─── QUICK COMMANDS" in cyan (#22D3EE), bold.

Instruction line: "  Type help for available commands" in dim grey (#5A6475).

One blank line, then 4 command example lines, each prefixed with "  $ " (dollar sign in muted grey #4A5568, then a space), command text in dim grey (#4A5568):

  $ carina ask "..."
  $ carina memory search
  $ carina scout status
  $ carina skill install

---

## BOTTOM PROMPT LINE

Full-width horizontal rule of box-drawing horizontal line characters in very dark grey (#2E3540), identical to the header rule.

Below the rule: the terminal prompt line. "● carina@launcher ~ $ █" where:
- "●" is a filled circle in green (#22C55E)
- " carina@launcher ~ $" is in green (#22C55E), monospace
- "█" is a solid block cursor character in green (#22C55E)

This entire prompt line is in green (#22C55E). It is the only line using green, except the ● prefix on the first QUICK ACTIONS item.

---

## COLOR SUMMARY

Background: #0A0A0A
Window title bar: #060606
Primary text: #D4D4D4
Secondary text: #9CA3AF
Dim text: #5A6475 and #4A5568
Cyan (section headers, [OK], progress bar, nav links): #22D3EE
Green (active indicator, terminal prompt): #22C55E
Horizontal rules and separators: #2E3540
Logo mark: gradient as in carina_10-final.png

No red, no purple, no orange, no yellow, no background highlight panels behind any text. No gradients on text or backgrounds except the logo graphic.

---

## WHAT NOT TO INCLUDE

- Any emoji character of any kind: no check marks, no warning triangles, no lock symbols, no stars, no fire, no sparkles, no rockets, no face characters, no hand characters
- GUI elements: no rounded buttons, no card shadows, no border-radius panels, no dropdown menus
- Sans-serif or display fonts in the content area (only the logo graphic is non-monospace)
- Background color panels or highlight blocks behind any text
- Column divider line between the two body columns
- Percentage rings, donut charts, or any graphical progress element other than the block-character bar described above
- Any content not specified in this prompt
- Any color not in the color summary above

---

## FINAL SPEC

Single image. 1280 x 800px. The terminal window fills the image with approximately 8px of neutral outer background showing the window shadow. The Carina gradient star mark in the top-left header is the single most visually striking element. All other visual interest comes from cyan section headers, the ▸ bullets, the [OK] tags, the [██████████] block bar, and the green prompt line. The impression is: precise, authoritative, unmistakably Carina.
