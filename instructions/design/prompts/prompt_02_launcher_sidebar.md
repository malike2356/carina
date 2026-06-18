# PROMPT 02: Carina Launcher - Left Sidebar Navigation Expanded
# Attach when sending: carina_10-final.png (logo reference)

---

Generate a single high-fidelity UI mockup of a desktop application window.
This is the sidebar-expanded state of the Carina launcher.
Output size: 1280 x 800px. Single image only.

This screen shows what happens when the user has expanded the left navigation panel.
The right content area (project cards, CONTINUE WORK button) is IDENTICAL to Screen 1.
The only difference is the left column: instead of the logo/wordmark/greeting, it becomes a full navigation sidebar.

---

## WINDOW CHROME

macOS-style window frame. Dark title bar, approximately 32px tall.
Left side of title bar: the three traffic light circles (red, yellow, green) at standard macOS size and spacing.
There is NO "CARINA LAUNCHER" text in the title bar for this screen. The title bar is otherwise empty except:
Far right of title bar: a small green filled circle (6px diameter, color #22C55E) followed by the word "ONLINE" in 11px uppercase muted grey. Right-aligned with 16px right padding.

Window background: #09101F (very dark navy, not pure black).

---

## LAYOUT STRUCTURE

The window is divided into two vertical sections:

LEFT SIDEBAR: exactly 220px wide, full window height (below the title bar).
MAIN CONTENT AREA: remaining width (~1060px), full window height.

The left sidebar has a very subtle right border: 1px solid #1F2937.

---

## LEFT SIDEBAR CONTENT

Background: #0B1220 (very slightly lighter than the window, or the same — just slightly distinct).

SIDEBAR TOP SECTION (padding: 20px 16px):
Row layout, horizontally aligned, vertically centered:
- Left: The Carina 6-arm snowflake/star mark at 22px x 22px, in gradient (refer to carina_10-final.png for colors — the same gradient multi-color star mark). No labels on the arms.
- Right of the icon, 10px gap: The text "Carina" in 16px bold, white (#F3F4F6), clean modern sans-serif.

Below that row, with 4px gap:
- The text "Laud's Workspace" in 12px, muted grey (#6B7280), regular weight. Left-aligned with 16px left padding.

Below that, a subtle horizontal rule: 1px solid #1F2937, full sidebar width, with 12px top margin.

NAVIGATION ITEMS:
8 navigation items stacked vertically, each item:
- Height: 40px
- Horizontal padding: 12px left and right
- Layout: horizontal flex row, vertically centered
- Border radius on hover: 6px (imply hover state on the active item only)
- Left: an icon, 18px x 18px, outline/line style (not filled)
- Right of icon, 12px gap: label text, 14px, regular weight

ITEM 1 - HOME (ACTIVE STATE):
- Left border: 2px solid #22D3EE (cyan accent), full item height
- Background: #0F1E32 (subtle highlight, slightly lighter than sidebar background)
- Icon: house outline icon, color #22D3EE (cyan)
- Label: "Home" in 14px, white (#F3F4F6), medium weight

ITEM 2 - WORKSPACES:
- No left border, no background highlight
- Icon: grid of 4 small squares outline icon, color #6B7280 (muted grey)
- Label: "Workspaces" in 14px, muted grey (#9CA3AF)

ITEM 3 - PROJECTS:
- Icon: folder outline icon, color #6B7280
- Label: "Projects" in 14px, muted grey (#9CA3AF)

ITEM 4 - MEMORY:
- Icon: layered circles or brain-like outline icon, color #6B7280
- Label: "Memory" in 14px, muted grey (#9CA3AF)

ITEM 5 - SKILLS:
- Icon: lightning bolt or star outline icon, color #6B7280
- Label: "Skills" in 14px, muted grey (#9CA3AF)

ITEM 6 - CHANNELS:
- Icon: paper plane or signal/antenna outline icon, color #6B7280
- Label: "Channels" in 14px, muted grey (#9CA3AF)

ITEM 7 - SCOUT:
- Icon: shield outline icon, color #6B7280
- Label: "Scout" in 14px, muted grey (#9CA3AF)

ITEM 8 - SETTINGS:
- Icon: gear/cog outline icon, color #6B7280
- Label: "Settings" in 14px, muted grey (#9CA3AF)

Note: Items 2 through 8 all have the same muted grey styling. No special treatment beyond the active item (Home).
There are no notification badges, counts, or indicators on any nav item.

SIDEBAR BOTTOM SECTION:
Pinned to the bottom of the sidebar, above the bottom status bar:
- Horizontal padding: 16px
- A subtle horizontal rule: 1px solid #1F2937 above this section
- Padding top: 14px, padding bottom: 14px

Layout: horizontal flex row, vertically centered:
- Left: A circular avatar, 34px diameter. Background: #1F2937 (dark grey). Text inside: "L" in 15px, white, bold, vertically and horizontally centered.
- Right of avatar, 10px gap: Two lines stacked:
  - Line 1: "Laud" in 13px, white (#F3F4F6), medium weight
  - Line 2: "Owner" in 12px, muted grey (#6B7280)

---

## MAIN CONTENT AREA (RIGHT OF SIDEBAR)

This area is EXACTLY the same as Screen 1's right column.
Reproduce it precisely:

Top padding: 40px from the top content area.
Left padding: 32px from the sidebar edge.
Right padding: 32px from the window right edge.

SECTION HEADER:
"PICK UP WHERE YOU LEFT OFF" in 11px uppercase, letter-spaced (tracking: 0.1em), muted grey (#6B7280). Bottom margin: 16px.

THREE PROJECT CARDS (identical to Screen 1):
Each card: background #111827, border 1px solid #1F2937, border radius 8px, padding 14px 16px, height ~60px.

Card 1:
- Icon: briefcase/folder outline, 32px container background #1F2937, icon color #F59E0B (amber)
- Name: "Propreneur" — 14px bold white
- Description: "Workspace" — 13px muted grey
- Time: "2 min ago" — 12px muted grey
- Chevron: "›" — 16px muted grey

Card 2:
- Icon: small Carina 6-arm star in gradient colors, 20px inside 32px container
- Name: "Carina" — 14px bold white
- Description: "Core Agent" — 13px muted grey
- Time: "1 hr ago" — 12px muted grey
- Chevron: "›" — 16px muted grey

Card 3:
- Icon: concentric circles/target in cyan (#22D3EE), inside 32px container
- Name: "Scout" — 14px bold white
- Description: "Dashboard Redesign" — 13px muted grey
- Time: "3 days ago" — 12px muted grey
- Chevron: "›" — 16px muted grey

VIEW ALL LINK:
"View all projects" in 13px cyan (#22D3EE), then a pill badge "12" with background #1E3A4A, text white 11px, horizontal padding 6px, border radius 10px.

CONTINUE WORK BUTTON:
Full width of the main content area minus 64px total padding (32px each side).
Height: 52px.
Gradient background: #22D3EE (left) to #06B6D4 (right).
Border radius: 8px.
Text: "CONTINUE WORK" — 15px bold uppercase white, letter-spaced (0.08em), centered.
Right arrow "→" in white, right-aligned 20px from right edge.

---

## BOTTOM STATUS BAR

Full width of the entire window (spanning both sidebar and main content area).
Height: 32px.
Top border: 1px solid #1F2937.
Content: four items horizontally distributed, vertically centered, 11px muted grey (#6B7280).
Vertical dividers (1px #1F2937) between each item.

Item 1: green dot (5px #22C55E) + "Scout: Protected"
Item 2: lock icon (12px) + "Encrypted"
Item 3: sync icon (12px) + "Synced"
Item 4: "v1.0.0"

---

## WHAT NOT TO INCLUDE

Do not include:
- Any system health percentage bars or panels anywhere in this design
- Any status items showing "Memory: 100%", "Skills Loaded", "Models Connected", etc.
- Any emoji characters
- Sub-navigation or nested nav items under any sidebar item
- Notification dot badges on sidebar items
- A search bar in the sidebar
- A collapse/toggle arrow on the sidebar (the sidebar is shown in its open/expanded state only)
- Any second column or panel to the right of the main content area
- Any floating tooltips or popover elements
- Background textures, gradients, noise, or particle effects on any solid color background

---

## FINAL SPEC

Single image. 1280 x 800px. High fidelity. Dark theme. The sidebar should feel like a premium navigation panel in a tool like Linear or Notion's dark mode — minimal, clean, functional. The main content area (right side) should be identical to Screen 1.
