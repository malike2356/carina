# GTM 006: Aiva marketing - surface the VA team story above the fold

**Sprint:** GTM readiness
**Prompt number:** 06
**Name:** Restructure the Aiva page so the human VA backup is the lead differentiator, not a footnote
**Primary agent:** Cursor
**Estimated hours:** 2-3 h
**Depends on:** Nothing (standalone)

**Status:** COMPLETED (2026-06-26)

---

## Context

The Aiva marketing page currently buries its most important differentiator. The fact that
every Aiva comes with a real human VA behind it - included, no extra fee, no separate
contract - only surfaces at Section 8 of 10 (labelled "Oversight"), where it is written
as a numbered list item behind two others.

The hero mentions "Backed by VERLOX humans" but only as the last clause in a tiny tagline
below two CTAs. Most visitors will not scroll past section 3.

The "Human handover" demo is tab number 3 of 4 in the Aiva in action section. The
billing dispute / James handoff is the clearest proof the product has - and it is hidden
behind two generic tabs.

This prompt corrects all three problems. The human backup story must be unmissable within
the first visible screen.

**No other AI tool on the market includes a real human team on every plan without an
add-on charge.** This is the reason to choose Aiva over a generic AI chatbot, and it is
currently indistinguishable from a footnote.

---

## File to edit

`03-frontends/marketing/carinaai.uk/aiva/index.html`

All changes are HTML/CSS within this single file. No JS changes needed.

---

## Change 1: Hero eyebrow, headline, and lead paragraph

**Location:** Lines around 1169-1177 (the `.hero-copy` block).

**The insight behind these changes:**
Most entrepreneurs are not short of staff. They are short of time. They spend their
day on email, scheduling, admin, follow-ups, reminders, and chasing - work that does
not find customers, close deals, or grow the business. Aiva names that pain and
solves it directly.

**Current eyebrow and headline:**
```html
<p class="hero-eyebrow">Aiva by VERLOX</p>
<h1>Delegate the daily work<br>your business keeps repeating.</h1>
<p class="hero-lead">Aiva carries messages, admin, follow-ups, bookings, customer questions, recurring workflows, and handoffs with Carina intelligence and human oversight.</p>
```

**Replace with:**
```html
<p class="hero-eyebrow">What if you could hire a worker that never sleeps?</p>
<h1>Most entrepreneurs don't have<br>a staffing problem.<br>They have a time problem.</h1>
<p class="hero-lead">Email, admin, scheduling, follow-ups, reminders - you spend hours on work that never moves the needle. Aiva takes it back. It handles the routine across all your channels, around the clock. When anything needs real judgment, a trained VERLOX VA steps in, same thread, immediately, no extra fee.</p>
```

**CSS note:** The headline is now three lines. Add a max-width to keep it from
stretching too wide on large screens. In the existing `<style>` block, find the rule for
`.hero-section h1` and add or update `max-width: 22ch;` if it is not already constrained.

**Why:** "Delegate the daily work your business keeps repeating" is generic - it could
describe a VA agency, a task app, or any automation tool. The new headline names the
exact pain ("time problem") that the target audience lives with every day. The eyebrow
turns the brand question from the brand assets directly into the reader's frame before
they read the headline. The lead paragraph then names the specific tasks they recognise
before promising the outcome.

---

## Change 2: Hero tagline

**Location:** The `.hero-tagline` paragraph (currently "Powered by Carina. Governed by
Scout. Backed by VERLOX humans.").

**Replace with:**
```html
<p class="hero-tagline">Human VA backup included on every plan. No add-ons. No extra contracts.</p>
```

**Why:** The current tagline buries the human element at the end of a feature list. This
version makes it a standalone claim that a visitor can read in under two seconds.

---

## Change 3: Hero stats block - swap one stat to name the VA team

**Location:** The `.hero-stats` block (currently "24/7 Always answering", "5 Channels
included", "15 days Free trial").

**Replace the middle stat with:**
```html
<div class="hero-stat">
  <strong>Human VA</strong>
  <span>Behind every plan</span>
</div>
```

Keep "24/7 Always answering" and "15 days Free trial" in their current positions.
Remove "5 Channels included" - channel count is a feature detail, not a differentiator.

---

## Change 4: Hero proof items - rename and rewrite "Risky work"

**Location:** The `.hero-proof` block. The last `.proof-item` currently reads:
```
Risky work
Escalate uncertainty to VERLOX humans, with Scout watching actions and boundaries.
```

**Replace with:**
```html
<div class="proof-item">
  <strong>When AI is not enough</strong>
  <span>A trained VERLOX VA steps in immediately. Billing disputes, sensitive complaints, high-stakes calls - handled by a real person in the same thread.</span>
</div>
```

**Why:** "Risky work" sounds alarming. "When AI is not enough" is honest and directly
names the VA backup in a way that a business owner understands.

---

## Change 5: Add a trust strip between the hero and Section 2b

Insert the following immediately after the closing `</section>` of the hero (before
`<!-- Section 2b: Why Aiva is different -->`):

```html
<!-- VA trust strip -->
<div class="va-strip">
  <div class="container va-strip-inner">
    <span class="va-strip-claim">The only AI employee that comes with a real human team included.</span>
    <span class="va-strip-detail">When Aiva reaches its confidence threshold, a trained VERLOX VA picks up the thread - immediately, in the same channel, invisibly to your customer. Included on every plan.</span>
  </div>
</div>
```

Add the following CSS inside the existing `<style>` block (near the other
`.section--dark` and `.section--light` rules):

```css
.va-strip {
  background: var(--amber, #f59e0b);
  color: var(--ink, #0d0d0d);
  padding: 1.25rem 0;
}
.va-strip-inner {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.va-strip-claim {
  font-weight: 700;
  font-size: 1rem;
  line-height: 1.3;
}
.va-strip-detail {
  font-size: 0.875rem;
  opacity: 0.82;
  line-height: 1.5;
  max-width: 70ch;
}
@media (min-width: 900px) {
  .va-strip-inner {
    flex-direction: row;
    align-items: center;
    gap: 2rem;
  }
  .va-strip-claim {
    flex-shrink: 0;
    max-width: 28ch;
    font-size: 1.05rem;
  }
}
```

**Why:** The amber strip appears immediately below the hero (above the fold on most
desktop viewports) and is impossible to miss. It is short enough to read in full in under
three seconds.

---

## Change 6: Move the "Human handover" demo tab to position 1

**Location:** The `<!-- Section: Aiva in action (demo) -->` block.

**Current tab order:**
1. Customer query
2. Booking
3. Human handover
4. Morning briefing

**New tab order:**
1. Human handover (the differentiator - show it first)
2. Customer query
3. Booking
4. Morning briefing

**Exact tab button changes (replace the entire `.demo-tabs` div):**
```html
<div class="demo-tabs" role="tablist" aria-label="Demo scenarios">
  <button class="demo-tab demo-tab--active" type="button" data-demo="demo-0" role="tab" aria-selected="true">Human handover</button>
  <button class="demo-tab" type="button" data-demo="demo-1" role="tab" aria-selected="false">Customer query</button>
  <button class="demo-tab" type="button" data-demo="demo-2" role="tab" aria-selected="false">Booking</button>
  <button class="demo-tab" type="button" data-demo="demo-3" role="tab" aria-selected="false">Morning briefing</button>
</div>
```

**Panel order changes:** Reorder the four `demo-panel` divs so that:
- `id="demo-0"` contains the "Human handover" content (currently in `demo-2`)
- `id="demo-1"` contains the "Customer query" content (currently in `demo-0`)
- `id="demo-2"` contains the "Booking" content (currently in `demo-1`)
- `id="demo-3"` contains the "Morning briefing" content (currently in `demo-3`, unchanged)

Add the `demo-panel--active` class to the new `demo-0` panel (Human handover).
Remove `demo-panel--active` from the previous `demo-0` (Customer query).

No JS changes are needed - the tab switching JS already uses `data-demo` attribute
matching, so re-ordering panels with matching `id`s is sufficient.

---

## Change 7: Section 2b headline - make it name the VA team

**Location:** `<!-- Section 2b: Why Aiva is different -->` around line 1230.

**Current:**
```html
<span class="section-label">The difference</span>
<h2>Why Aiva is different</h2>
<p class="section-lead">Most AI tools answer prompts. Aiva carries work across channels, follows routines, and knows when a human should step in.</p>
```

**Replace with:**
```html
<span class="section-label">The difference</span>
<h2>AI does the routine. Humans handle the rest.</h2>
<p class="section-lead">Every other AI tool stops when it hits something hard. Aiva passes it to a real person. That is the difference.</p>
```

---

## Acceptance criteria

- [x] The hero headline names the time-problem framing; hero lead and tagline surface VA backup above the fold
- [x] The hero tagline is a standalone claim about VA backup, not a feature list
- [x] The hero stats block includes "Human VA - Behind every plan"
- [x] The amber VA strip renders below the hero and above Section 2b
- [x] The amber strip is visible without scrolling on a 1280x800 desktop viewport
- [x] The first demo tab shown is "Human handover", not "Customer query"
- [x] Section 2b headline names the human/AI split rather than saying "Why Aiva is different"
- [x] Page renders without layout breaks at 375px (mobile), 768px (tablet), 1280px (desktop)
- [x] All existing sections below Section 2b are unchanged (GTM-007 VA mid-page section added separately)
- [x] No em dashes, no en dashes, no emojis in any edited lines
- [x] No competitor names in any user-visible string

## Completion note

Completed 2026-06-26.

| Change | Location |
|--------|----------|
| Hero eyebrow, headline, lead, tagline, stats | `.hero-copy` |
| Hero proof item "When AI is not enough" | `.hero-proof` |
| Amber `.va-strip` | Between hero and Section 2b |
| Demo tab order: Human handover first | `#aiva-in-action` |
| Section 2b headline | `.diff-section` |
| `max-width: 22ch` on hero h1 | `<style>` block |

File: `03-frontends/marketing/carinaai.uk/aiva/index.html`

## Do not touch

- Section 3 (Three pillars) and below - those are addressed in GTM-007
- Any JS in the file except the demo tab init if needed for panel reorder
- The hero chat animation (`.conv-bubble[data-chat-pending]` scroll logic)
- The `<script>` block that fetches pricing from `core.carinaai.uk`
- `style.css` (all CSS changes go inside the existing inline `<style>` block in this file)
- Any other marketing file (`index.html`, `pricing/index.html`, etc.)
