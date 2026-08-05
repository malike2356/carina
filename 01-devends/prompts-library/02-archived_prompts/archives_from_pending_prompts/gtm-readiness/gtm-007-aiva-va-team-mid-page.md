# GTM 007: Aiva marketing - dedicated VA team section and page restructure

**Status: COMPLETED 2026-07-26**

**What was built:**
- Implemented and archived

**Sprint:** GTM readiness
**Prompt number:** 07
**Name:** Insert a dedicated "Your VA team" section mid-page and move the trust table up
**Primary agent:** Cursor
**Estimated hours:** 2-3 h
**Depends on:** GTM-006 (builds on top of it; implement GTM-006 first)

**Status:** COMPLETED (2026-06-26)

---

## Context

After GTM-006 surfaces the VA team in the hero and adds the amber trust strip, a
visitor scrolling past the hero still encounters five sections before they see the full
human backup story (which currently lives at Section 8: Trust). Informed buyers - the
ones who will actually convert - want to understand HOW the human backup works before
they care about channels, automation examples, or the pricing table.

This prompt does three things:

1. Inserts a new "Behind every Aiva" section immediately after the "Why Aiva is
   different" comparison table. This section tells the VA team story visually - who they
   are, what triggers a handover, what the customer experiences - before the visitor
   reaches the demo section.

2. Adds a "time breakdown" callout inside the new section that mirrors the brand
   positioning ("too much time on X, not enough time on Y") so the journey from hero
   to this section stays coherent.

3. Condenses Section 8 (Trust) because the full story is now told earlier. The trust
   section becomes a brief "three guarantees" summary rather than the first place the VA
   team is mentioned at length.

---

## File to edit

`03-frontends/marketing/carinaai.uk/aiva/index.html`

---

## Change 1: Insert the "Behind every Aiva" section

Insert the following HTML immediately after the closing `</section>` of
`<!-- Section 2b: Why Aiva is different -->` and before
`<!-- Section: Aiva in action (demo) -->`.

```html
<!-- Section: VA team story -->
<section class="va-team-section section--light" id="va-team">
  <div class="container">
    <span class="section-label">Behind every Aiva</span>
    <h2>A real team is behind every response.</h2>
    <p class="section-lead">Aiva is not just software. It is a trained AI with a human team backing it. When Aiva reaches its confidence threshold, the work passes to a real person - automatically, in the same channel, before your customer knows anything has changed.</p>

    <div class="va-team-grid">

      <div class="va-team-col">
        <h3>What Aiva handles alone</h3>
        <ul class="va-list va-list--auto">
          <li>Inbound enquiries and questions</li>
          <li>Appointment bookings and confirmations</li>
          <li>Routine follow-ups and reminders</li>
          <li>Admin triage and document sorting</li>
          <li>Scheduled reports and briefings</li>
          <li>Channel routing and thread summaries</li>
        </ul>
      </div>

      <div class="va-team-divider" aria-hidden="true">
        <div class="va-team-divider-line"></div>
        <span class="va-team-divider-label">when AI reaches its limit</span>
        <div class="va-team-divider-arrow">&#8595;</div>
      </div>

      <div class="va-team-col">
        <h3>What the VERLOX VA team handles</h3>
        <ul class="va-list va-list--human">
          <li>Billing disputes and refund decisions</li>
          <li>Sensitive or emotional complaints</li>
          <li>High-value or high-risk calls</li>
          <li>Anything requiring account access or judgment</li>
          <li>Legal, compliance, or confidentiality queries</li>
          <li>Anything Aiva flags as uncertain</li>
        </ul>
        <p class="va-team-note">The handover is invisible to the customer. They stay in the same thread and never know they moved from AI to human.</p>
      </div>

    </div>

    <div class="va-time-callout">
      <div class="va-time-col va-time-col--left">
        <p class="va-time-label">Too much of your time on</p>
        <ul>
          <li>Email and follow-ups</li>
          <li>Scheduling</li>
          <li>Documents and admin</li>
          <li>Reminders and chasing</li>
          <li>Managing systems</li>
        </ul>
        <p class="va-time-note">None of these make money.</p>
      </div>
      <div class="va-time-arrow" aria-hidden="true">&#8594;</div>
      <div class="va-time-col va-time-col--right">
        <p class="va-time-label">Free to focus on</p>
        <ul>
          <li>Finding customers</li>
          <li>Closing deals</li>
          <li>Building relationships</li>
          <li>Growing the business</li>
        </ul>
        <p class="va-time-note">This is what moves the needle.</p>
      </div>
    </div>

    <div class="va-team-cta-row">
      <a href="https://aiva.carinaai.uk/register" class="btn btn-primary">Start free - 15 days</a>
      <span class="va-team-cta-note">Human VA backup included. No extra fee on any plan.</span>
    </div>
  </div>
</section>
```

---

## Change 2: CSS for the new section

Add the following inside the existing `<style>` block in the file:

```css
/* VA team section */
.va-team-section { padding: 5rem 0; }

.va-team-grid {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 2rem;
  margin: 3rem 0 2.5rem;
  align-items: start;
}

.va-team-col h3 {
  font-size: 1rem;
  font-weight: 700;
  margin-bottom: 1rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.va-list {
  list-style: none;
  padding: 0;
  margin: 0 0 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.va-list li {
  font-size: 0.9375rem;
  padding-left: 1.2em;
  position: relative;
  line-height: 1.45;
}

.va-list--auto li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.55em;
  width: 0.45em;
  height: 0.45em;
  border-radius: 50%;
  background: var(--carina-blue, #0099cc);
}

.va-list--human li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.55em;
  width: 0.45em;
  height: 0.45em;
  border-radius: 50%;
  background: var(--amber, #f59e0b);
}

.va-team-note {
  font-size: 0.8125rem;
  font-style: italic;
  margin-top: 0.75rem;
  opacity: 0.7;
}

.va-team-divider {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding-top: 2.5rem;
}

.va-team-divider-line {
  width: 1px;
  flex: 1;
  background: currentColor;
  opacity: 0.15;
  min-height: 2rem;
}

.va-team-divider-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  opacity: 0.45;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  white-space: nowrap;
}

.va-team-divider-arrow {
  font-size: 1.1rem;
  opacity: 0.4;
}

/* Time callout */
.va-time-callout {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 1.5rem 2rem;
  align-items: center;
  background: var(--surface-2, rgba(0,0,0,0.04));
  border-radius: 0.75rem;
  padding: 2rem;
  margin: 2rem 0 2.5rem;
}

.va-time-label {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 700;
  margin-bottom: 0.75rem;
  opacity: 0.6;
}

.va-time-col ul {
  list-style: none;
  padding: 0;
  margin: 0 0 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.va-time-col ul li {
  font-size: 0.9rem;
  padding-left: 1.1em;
  position: relative;
}

.va-time-col--left ul li::before {
  content: '-';
  position: absolute;
  left: 0;
  opacity: 0.4;
}

.va-time-col--right ul li::before {
  content: '+';
  position: absolute;
  left: 0;
  color: var(--carina-blue, #0099cc);
  font-weight: 700;
}

.va-time-note {
  font-size: 0.78rem;
  opacity: 0.55;
  margin: 0;
}

.va-time-arrow {
  font-size: 1.75rem;
  opacity: 0.35;
  text-align: center;
}

/* CTA row */
.va-team-cta-row {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  flex-wrap: wrap;
}

.va-team-cta-note {
  font-size: 0.875rem;
  opacity: 0.65;
}

/* Responsive */
@media (max-width: 768px) {
  .va-team-grid {
    grid-template-columns: 1fr;
  }
  .va-team-divider {
    flex-direction: row;
    padding-top: 0;
    padding: 0.5rem 0;
  }
  .va-team-divider-label {
    writing-mode: horizontal-tb;
  }
  .va-team-divider-line {
    width: 2rem;
    height: 1px;
    min-height: auto;
  }
  .va-time-callout {
    grid-template-columns: 1fr;
  }
  .va-time-arrow {
    transform: rotate(90deg);
    font-size: 1.25rem;
  }
}
```

---

## Change 3: Condense Section 8 (Trust)

Section 8 currently has three numbered paragraphs, a comparison table, and a footnote.
After GTM-006 and this prompt, the VA backup story is told twice before Section 8.
Condensing it prevents repetition and keeps the page from feeling padded.

**Location:** `<!-- Section 8: Trust -->` around line 1614.

**Replace the entire section content with the condensed version below.** Keep the
`<section>` wrapper and its classes exactly as they are. Only replace the inner
`<div class="container">` content.

```html
<div class="container">
  <span class="section-label">Oversight</span>
  <h2>Three guarantees. Built in. No add-ons.</h2>

  <div class="trust-pills">

    <div class="trust-pill">
      <strong>Human VA backup</strong>
      <p>Every Aiva has a confidence threshold. When a task is ambiguous, emotional, or outside its scope, a trained VERLOX VA picks it up immediately, in the same thread. Included on every plan.</p>
    </div>

    <div class="trust-pill">
      <strong>Governance layer active</strong>
      <p>Every message, tool call, and automation run passes through built-in governance monitoring. Volume spikes, repeated failures, and out-of-scope actions are caught and paused before your client sees a problem.</p>
    </div>

    <div class="trust-pill">
      <strong>Full tamper-evident audit log</strong>
      <p>Every action is logged with a cryptographic content hash, stored by VERLOX, and available on request. If a client or auditor asks what your Aiva did on a given date, you can show them the exact sequence of events.</p>
    </div>

  </div>

  <p class="trust-scout-note">For advanced AI governance across your whole stack, see <a href="https://labyrinthscout.com">Labyrinth Scout</a>.</p>
</div>
```

Add the following CSS inside the existing `<style>` block for the new trust pill layout:

```css
.trust-pills {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
  margin: 2.5rem 0 2rem;
}

.trust-pill {
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 0.75rem;
  padding: 1.5rem;
}

.trust-pill strong {
  display: block;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.75rem;
  color: var(--amber, #f59e0b);
}

.trust-pill p {
  font-size: 0.875rem;
  line-height: 1.6;
  margin: 0;
  opacity: 0.8;
}

@media (max-width: 900px) {
  .trust-pills {
    grid-template-columns: 1fr;
  }
}
```

**Remove** the old `.trust-point`, `.trust-prose`, `.trust-grid`, `.trust-table-wrap`,
`.trust-table`, and `.trust-privacy-note` CSS rules if they are no longer used anywhere
else in the file. If those class names appear in other sections, leave the CSS in place.

---

## Acceptance criteria

- [x] A new "Behind every Aiva" section exists between Section 2b and the demo section
- [x] The new section shows two columns: "What Aiva handles alone" vs "What the VA team handles"
- [x] The time callout ("Too much of your time on" / "Free to focus on") renders inside the new section
- [x] The new section has a CTA linking to the Aiva register URL
- [x] Section 8 (Trust) is condensed to three horizontal pill cards
- [x] The trust table (old `.trust-table`) is removed
- [x] Page scroll order is: hero, trust strip (amber), Why Aiva is different, VA team story, demo section, pillars, how it works, role templates, channels, automation, trust guarantees, pricing, CTA (trust strip pending GTM-006)
- [x] All sections render without layout breaks at 375px, 768px, and 1280px
- [x] Colours use existing CSS variables (`--amber`, `--carina-blue`, etc.) - no hardcoded hex values for brand colours unless the variable is not already defined in the file
- [x] No em dashes, no en dashes, no emojis in any edited lines
- [x] No competitor names in any user-visible string

## Completion note

Completed 2026-06-26.

| Change | Location |
|--------|----------|
| VA team section (`#va-team`) | After Section 2b, before demo |
| VA team + time callout CSS | `<style>` block |
| Trust section condensed to `.trust-pills` | Section 8 |
| Removed `.trust-table`, `.trust-grid`, `.trust-point` CSS/HTML | Section 8 only |

File: `03-frontends/marketing/carinaai.uk/aiva/index.html`

## Do not touch

- Any section outside the ones listed above (Channels, Role templates, Automation examples, Pricing, Footer)
- The pricing fetch script at the bottom of the file
- The demo tab JS or animation JS
- Any file other than `aiva/index.html`
- `.env` files
