# Gap 02 - File 3: Hub Public Website

Agent: Claude Code (primary), Codex (fallback)
Estimated time: 4-6 hours

---

## Context

`core.carinaai.uk/src/skills/hub/public/` currently has three skeleton
files: `index.html`, `hub.js`, and `hub.css`. The hub Express server
serves this directory as static files via `express.static(PUBLIC_DIR)`.

The task is to replace the skeleton with a real multi-page static site
(no build step, no framework - plain HTML, CSS, and vanilla JS). All
data comes from the existing hub API.

The hub API base URL in production is `https://hub.carinaai.uk`. In
development (when served from localhost:3001) it is `/` relative. Pages
must auto-detect: if `window.location.hostname` is `localhost` or
`127.0.0.1`, use relative URLs; otherwise use `https://hub.carinaai.uk`.

---

## Step 1: Read these files first

1. `src/skills/hub/public/index.html` - existing skeleton structure and
   any CSS classes already in use
2. `src/skills/hub/public/hub.js` - existing JS; understand what it
   already does before overwriting
3. `src/skills/hub/public/hub.css` - existing styles
4. `src/skills/hub/server.ts` lines 126-270 - all the API routes you can
   call: `/api/registry`, `/api/packs`, `/api/packs/:name`,
   `/api/skills`, `/api/skills/:pack/:name`, `/api/categories`,
   `/api/marketplace`, `/api/v1/skills/:pack/:name/reviews` (added in
   file 02)

---

## Step 2: Shared layout rules

Every page must share the same `hub.css` stylesheet and a common
`<nav>` element. The nav links are:

- "Carina Hub" (logo/home, links to `/`)
- "Browse" (links to `/browse.html`)
- "Publish" (links to `/publish.html`)

Use a consistent color scheme:
- Background: `#0f1117`
- Surface card: `#1a1d27`
- Accent: `#6c63ff`
- Text primary: `#e8e9f0`
- Text muted: `#8b8fa8`
- Verified badge: `#22c55e` (green text, dark green bg)
- Community badge: `#8b8fa8` (grey)
- Star filled: `#f59e0b`
- Star empty: `#3a3d52`

Include a minimal CSS reset and make the site responsive at 600px
breakpoint.

---

## Step 3: index.html (homepage)

Replace the existing `index.html` entirely.

Sections:

**Hero section:** "Carina Hub - Skills Marketplace" heading, "Discover
and install community skill packs for Carina AI" subheading, and an
inline search input (searches /api/packs?q=).

**Stats bar:** 3 numbers pulled from `GET /api/registry`:
`packCount`, `skillCount`, and a static "Free and open" label.

**Featured packs grid:** Call `GET /api/packs?featured=true`, render up
to 6 cards. Each card shows: pack name, author, description (first 80
chars), category badge, skill count, download count, and a
"carina hub install pack:<name>" copy button.

**Trending this week section:** Call `GET /api/packs` (no filter),
sort client-side by `download_count` descending, take top 5, render
as a compact list with name and download count.

**Category pills:** Call `GET /api/categories`, render clickable pills
that link to `browse.html?category=<value>`.

---

## Step 4: browse.html

New file in `public/browse.html`.

**Filter sidebar (or top filter bar on mobile):**
- Text search input (debounced 300ms, calls `/api/packs?q=`)
- Category filter: call `/api/categories` and render as checkboxes or
  a select; add to URL as `?category=<value>`
- Verified only checkbox: filters to packs where `featured=true` (the
  closest equivalent until a verified flag is added server-side)
- Sort: select with options "Most installed" (sort by download_count),
  "Newest" (sort by created_at), "Name A-Z"

**Results grid:** paginated 12 per page. Each card: pack name (links to
`skill.html?pack=<name>`), author, category badge, skill_count,
download_count, description excerpt, and install copy button.

**Pagination controls:** Previous / Next buttons. Track `offset` in URL
params (`?offset=12`).

Read query params on page load to restore filter state.

---

## Step 5: skill.html (pack detail page)

New file in `public/skill.html`.

Read `?pack=<name>` from the URL. Call `GET /api/packs/:name`.

Sections:

**Pack header:** Name, version badge, author, description, category
badge, "Verified by Carina" badge (shown if `featured === true` for now),
install count, last updated date.

**Install command box:**
```
carina hub install pack:<name>
```
Render as a code block with a "Copy" button. On click, copy to clipboard
and show "Copied!" for 2 seconds.

**Skills list:** The response from `/api/packs/:name` includes a
`skills` array. Render as a table with columns: skill name, description,
triggers (comma list), tools used (comma list).

**Star rating display:** Show the average rating (from the `rating_avg`
column added in file 02). Render as 5 star icons with partial fill if
applicable. Show `review_count` next to it.

**Reviews section:** Call `GET /api/v1/skills/:pack/:name/reviews` for
the first skill in the pack (or aggregate - use best judgment). Render
each review as: star rating, body text, author_id (truncated to 12
chars), date.

**Submit review form:** Fields: Your ID (text, required), Rating (1-5
stars clickable), Review text (textarea). On submit, POST to
`/api/v1/skills/:pack/:name/reviews`. Show success or error inline.

**Versions section:** Show `version` from the pack metadata.

---

## Step 6: publish.html

New file in `public/publish.html`.

A form with these fields:
- Pack name (text, required, pattern `[a-z][a-z0-9-]{0,62}`)
- Display name (text, required)
- Version (text, default `1.0.0`)
- Author (text, required)
- Description (textarea, required, max 500 chars)
- Category (select: property-uk, development, productivity, research,
  communication, finance, other)
- Tags (text, comma-separated)
- API Key (password field, required - sent as `X-Api-Key` header)
- Skill YAML content (large textarea)

On submit, POST to `/api/marketplace/publish` with JSON body and the
API key in the header. Show the response `badge` and `pendingVerification`
flag to the user. If `pendingVerification: true`, show "Your submission
is in review". If `badge: 'community'`, show "Published - community
badge awarded".

---

## Step 7: author.html

New file in `public/author.html`.

Read `?author=<name>` from URL. Call
`GET /api/author/packs?author=<name>` (requires `X-Api-Key` header - so
this page also needs an API key input, or just show a prompt to enter
the key).

Render the author's packs as a list with stats: pack name, version,
skill count, download count, featured badge.

---

## Step 8: Shared JS utilities

Rewrite `public/hub.js` as the shared utility module (included on every
page via `<script src="/hub.js"></script>`).

Expose a global `CarinaHub` object with:

```javascript
window.CarinaHub = {
  apiBase,        // '' on localhost, 'https://hub.carinaai.uk' in prod
  api(path),      // fetch wrapper returning parsed JSON
  renderStars(rating, max=5),  // returns HTML string of star spans
  copyToClipboard(text),       // copies and returns a promise
  badgePill(label, type),      // returns HTML for a badge span
  formatDate(iso),             // returns 'Jun 2026' style string
  debounce(fn, ms),            // standard debounce
};
```

Each page's inline script or its own `<script>` tag calls these
utilities. Do not use ES modules (no `import`/`export`) - the files are
served as plain static HTML with script tags.

---

## Files to create or modify

| File | Action |
|---|---|
| `src/skills/hub/public/index.html` | REPLACE entirely |
| `src/skills/hub/public/hub.js` | REPLACE entirely (shared utilities) |
| `src/skills/hub/public/hub.css` | REPLACE entirely (full styles) |
| `src/skills/hub/public/browse.html` | CREATE |
| `src/skills/hub/public/skill.html` | CREATE |
| `src/skills/hub/public/publish.html` | CREATE |
| `src/skills/hub/public/author.html` | CREATE |

Do not touch any TypeScript files.

---

## Done-when criteria

- [ ] Opening `http://localhost:3001/` shows the homepage with real data
  from the hub API (stats bar, featured packs, category pills)
- [ ] `browse.html` loads, search input filters packs, pagination works
- [ ] `skill.html?pack=<existing-pack-name>` shows pack detail and skills
  table
- [ ] `publish.html` form submits and shows a success or error message
- [ ] `author.html?author=<name>` shows packs for that author
- [ ] Install copy buttons copy the correct `carina hub install pack:<name>`
  command and show "Copied!" feedback
- [ ] "Verified by Carina" badge appears on featured packs
- [ ] Star rating component renders correctly for 0, 3.5, and 5
- [ ] Site is usable on 600px viewport (mobile)
- [ ] No console errors on any page
- [ ] No framework or build step required - all files are vanilla
  HTML/CSS/JS

---

## Do NOT do

- Do not use React, Vue, Svelte, or any JS framework
- Do not add a build step or bundler
- Do not add authentication pages (login/logout is a separate file)
- Do not add any server-side rendering; the Express server already serves
  the files statically
- Do not modify any TypeScript source files
