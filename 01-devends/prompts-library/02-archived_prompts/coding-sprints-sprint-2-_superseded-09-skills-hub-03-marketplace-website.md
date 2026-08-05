# Prompt 03: Public Skills Marketplace Website


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Context

Approved skills need a public home where operators can discover, browse, and install them.
The marketplace is a static website at `skills.carinaai.uk` (subdomain of carinaai.uk).
It uses the same dark design system as the marketing site.

## What to Build

### 1. Marketplace website structure

Create `skills.carinaai.uk/` as a static site:
```
skills.carinaai.uk/
├── index.html          - browse all skills
├── skill/
│   └── [id].html       - individual skill page
├── categories/
│   └── index.html      - category index
├── style.css           - dark design system
├── app.js              - search, filter, install flow
└── assets/
```

### 2. Browse page (`index.html`)

```html
<!-- Search and filter bar -->
<div class="toolbar">
  <input type="search" id="search" placeholder="Search skills..." />
  <div class="filters">
    <button data-category="security">Security</button>
    <button data-category="productivity">Productivity</button>
    <button data-category="research">Research</button>
    <!-- all pack categories -->
  </div>
  <select id="sort">
    <option value="newest">Newest</option>
    <option value="installs">Most installed</option>
    <option value="rating">Top rated</option>
  </select>
</div>

<!-- Skills grid -->
<div class="skills-grid" id="skills-grid">
  <!-- Populated from GET https://core.carinaai.uk/api/skills -->
</div>
```

Each skill card:
```html
<div class="skill-card">
  <div class="skill-header">
    <span class="skill-icon">...</span>
    <h3>property-valuation</h3>
  </div>
  <p class="skill-desc">Analyzes UK property values from Rightmove, Zoopla...</p>
  <div class="skill-meta">
    <span>property-uk pack</span>
    <span>847 installs</span>
    <span> 4.8</span>
  </div>
  <button class="install-btn" data-skill="property-valuation">
    Install
  </button>
</div>
```

### 3. Install flow

Clicking "Install" opens a modal:
```
Install property-valuation

carina skills install property-valuation

Or click "Copy" and paste in your terminal.

[ Copy command ]  [ Open in Carina ]
```

"Open in Carina" triggers the `carina://skills/install/property-valuation` deep link
(opens Carina desktop app or web app and triggers install).

### 4. Skill detail page

`skill/[id].html` shows:
- Full skill description
- Code preview (syntax highlighted, first 50 lines)
- Required permissions list
- Compatibility: which Carina versions are supported
- Install instructions (CLI command)
- Rating and review count
- Related skills

### 5. Skills API changes

Add public endpoints to Carina core for marketplace:
```
GET /api/marketplace/skills           - paginated list of published skills
GET /api/marketplace/skills/:id       - skill detail
POST /api/marketplace/skills/:id/install - trigger install for authenticated user
POST /api/marketplace/skills/:id/rate  - rate a skill (1-5 stars, authenticated)
```

### 6. Deploy to `skills.carinaai.uk`

Add to `scripts/deploy-marketing.sh`:
```bash
# Deploy skills marketplace
rsync -av skills.carinaai.uk/ "$VPS_USER@$VPS_HOST:/var/www/skills.carinaai.uk/"
```

Add nginx vhost for `skills.carinaai.uk` in `docker/nginx/conf.d/skills.conf`.

## Verification Checklist

- [ ] Browse page loads and shows approved skills from API
- [ ] Search for "property" filters skills to matching names/descriptions
- [ ] Category filter shows only skills in that category
- [ ] Install button shows modal with CLI command
- [ ] "Copy command" button copies `carina skills install <name>` to clipboard
- [ ] `skills.carinaai.uk` is accessible at the subdomain

## Files to Create or Modify

- CREATE `skills.carinaai.uk/index.html`
- CREATE `skills.carinaai.uk/style.css`
- CREATE `skills.carinaai.uk/app.js`
- CREATE `skills.carinaai.uk/skill/` (dynamic-ish via JS templating)
- MODIFY `src/api/marketplace.ts` - public skills API
- MODIFY `docker/nginx/conf.d/` - add skills vhost
- MODIFY `scripts/deploy-marketing.sh` - add skills deploy step
