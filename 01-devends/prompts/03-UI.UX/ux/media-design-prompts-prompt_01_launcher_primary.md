# PROMPT 01: Carina Launcher - Primary Entry Screen
# Attach when sending: carina_10-final.png (logo reference)

---

Generate a single high-fidelity UI mockup of a desktop application window.
This is the primary launcher screen for Carina, an AI agent platform.
Output size: 1280 x 800px. Single image only.

---

## WINDOW CHROME

macOS-style window frame. Dark title bar, approximately 32px tall.
Left side of title bar: the three traffic light circles (red, yellow, green) at standard macOS size and spacing.
Immediately right of the traffic lights: a small 6-arm snowflake/star icon in gradient colors (described below), then the text "CARINA LAUNCHER" in uppercase, letter-spaced, at approximately 11px, in muted grey (#6B7280). No other elements in the title bar except:
Far right of title bar: a small green filled circle (6px diameter, color #22C55E) followed by the word "ONLINE" in 11px uppercase muted grey. Right-align this to the title bar with 16px right padding.

Window background: #09101F (very dark navy, not pure black).

---

## LAYOUT STRUCTURE

The window is divided into two vertical columns.

LEFT COLUMN: occupies the leftmost 38% of the window width.
RIGHT COLUMN: occupies the remaining 62% of the window width.

There is no visible divider line between the columns. The separation is implied by content alignment only.

---

## LEFT COLUMN CONTENT

Everything in this column is horizontally centered.

LOGO MARK:
Place the Carina star/snowflake logo mark (refer to the attached carina_10-final.png for the exact symbol shape) at 120px width and height, vertically centered in the upper portion of this column, leaving approximately 80px of padding from the top content area (below the title bar).

The logo mark is a 6-arm snowflake shape. Each arm ends in a colored dot. The arm lines and the connecting structure have a gradient that shifts from deep blue at the center outward through cyan, teal, violet, gold, and soft pink. The center of the logo has a bright cyan/white glow. The dots at the arm tips are distinctly colored: approximately top-left purple, top-right blue, right yellow/gold, bottom-right green/teal, bottom-left orange/amber, left magenta/pink. The background of the logo area is transparent (the window background shows through).

Do NOT add any text labels to the arms of the logo mark. It is used here purely as a brand symbol, not as a diagram.

WORDMARK:
Directly below the logo mark, with 16px gap:
The text "Carina" in bold, white (#FFFFFF), approximately 48px, in a clean modern sans-serif font (Inter, Geist, or similar; clean, geometric, no serifs, no decorative features).

TAGLINE:
Directly below the wordmark, with 8px gap:
The text "ONE MEMORY. ONE AGENT. EVERYWHERE." in uppercase, letter-spaced (tracking: 0.12em), approximately 11px, muted grey (#9CA3AF). No bold.

GREETING:
Below the tagline, with 40px gap:
The text "Good evening, Laud." in approximately 20px, white (#E4E8F0), regular weight (not bold). Left-align this text within the column (not centered). No emoji. No exclamation mark. Period at the end.

SUBTEXT:
Directly below the greeting, with 6px gap:
The text "3 active projects." in approximately 14px, muted grey (#6B7280), regular weight. Left-align within the column.

---

## RIGHT COLUMN CONTENT

Top padding: 40px from the top content area.
Left padding: 32px from the column edge.
Right padding: 32px from the window edge.

SECTION HEADER:
"PICK UP WHERE YOU LEFT OFF" in 11px uppercase, letter-spaced (tracking: 0.1em), muted grey (#6B7280). No bold. Bottom margin: 16px.

PROJECT CARDS:
Three cards stacked vertically, each with 10px gap between them.

Each card:
- Background: #111827 (dark surface, slightly lighter than the window background)
- Border: 1px solid #1F2937 (subtle dark border)
- Border radius: 8px
- Padding: 14px 16px
- Height: approximately 60px
- Layout: horizontal flex row

Left side of card: a small icon, 32px x 32px, in a slightly lighter square container (background #1F2937, border radius 6px). The icon is a simple line/outline icon.
Middle of card: two lines of text stacked.
  - Line 1: project name, 14px, bold, white (#F3F4F6)
  - Line 2: project description, 13px, muted grey (#6B7280)
Right side of card: two items right-aligned.
  - Time ago: 12px, muted grey (#6B7280)
  - Chevron: "›" character or right-pointing angle bracket, 16px, muted grey (#4B5563)

CARD 1 CONTENT:
Icon: a simple briefcase or folder outline icon, colored in muted amber/orange (#F59E0B).
Project name: "Propreneur"
Description: "Workspace"
Time: "2 min ago"

CARD 2 CONTENT:
Icon: a small version of the Carina 6-arm star/snowflake icon in gradient (same colors as the main logo mark, just at 20px within the 32px container).
Project name: "Carina"
Description: "Core Agent"
Time: "1 hr ago"

CARD 3 CONTENT:
Icon: a concentric circles or target/crosshair icon in cyan (#22D3EE), representing the Scout product.
Project name: "Scout"
Description: "Dashboard Redesign"
Time: "3 days ago"

VIEW ALL LINK:
Below the three cards, with 14px gap:
Left-aligned text: "View all projects" in 13px, cyan (#22D3EE), no underline.
Immediately right of the text, with 8px gap: a small pill-shaped badge with background #1E3A4A, text "12" in 11px white, horizontal padding 6px, border radius 10px.

CONTINUE WORK BUTTON:
Below the View all link, with 20px gap.
Full width of the right column (minus the 32px padding on each side).
Height: 52px.
Background: horizontal gradient from #22D3EE (left) to #06B6D4 (right).
Border radius: 8px.
Text: "CONTINUE WORK" in 15px, bold, uppercase, white (#FFFFFF), letter-spaced (tracking: 0.08em). Centered in the button.
Right side of button: a right-pointing arrow "→" in white, 16px, positioned 20px from the right edge of the button.
No border on the button. The gradient is the full fill.

---

## BOTTOM STATUS BAR

Full width of the window. Height: 32px.
Background: #060C18 (slightly darker than the window background, or just use a 1px solid top border #1F2937 on the same background color).
Separator line: 1px solid #1F2937 above the bar.
Content: four items arranged horizontally with equal spacing, vertically centered in the bar.
Font: 11px, muted grey (#6B7280).
Between each item: a vertical divider line, 1px, #1F2937, full height of the bar.

Item 1: A small green filled circle (5px, #22C55E) followed by 6px gap then "Scout: Protected"
Item 2: A small lock/padlock outline icon (12px, #6B7280) followed by 6px gap then "Encrypted"
Item 3: A small circular arrows/sync outline icon (12px, #6B7280) followed by 6px gap then "Synced"
Item 4: "v1.0.0"

---

## WHAT NOT TO INCLUDE

Do not include:
- Any system health percentage bars or panels (Memory: 100%, Models: 100%, etc.)
- Any panel showing "Skills Loaded", "Channels Connected", "Models Ready" as status items
- Any emoji characters anywhere in the design
- Any marketing copy or feature descriptions
- A search bar or input field
- Any notification badges other than the project count badge described above
- Multiple panels or columns beyond the two described
- Any background gradients, glow effects, or particle effects on the window background itself; it must be flat dark navy

---

## FINAL SPEC

Single image. 1280 x 800px. High fidelity. Dark theme. Clean, premium desktop application aesthetic. The dominant visual hierarchy is: logo mark, then project cards and CONTINUE WORK button. Everything else is secondary.
