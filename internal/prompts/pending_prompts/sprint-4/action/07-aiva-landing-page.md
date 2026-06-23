# Sprint 4 - Prompt 07: Aiva Landing Page (carinaai.uk/aiva/)

**Sprint:** 4
**Prompt number:** 07
**File:** `frontends/marketing/carinaai.uk/aiva/index.html`
**Primary agent:** Codex
**Estimated hours:** 5-7 h
**Depends on:** Nothing. Build in parallel with 08.

---

## Post-build (MANDATORY)

When all "Done When" criteria are satisfied:
1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file.
2. Move to `internal/prompts/archived_prompts/archives_from_pending_prompts/sprint-4/action/`.

---

## Read First

Before writing a single line of HTML:

1. `frontends/marketing/carinaai.uk/vertical.css` - all design tokens, layout classes, nav, footer
2. `frontends/marketing/carinaai.uk/_nav-snippet.html` - canonical nav; copy verbatim
3. `frontends/marketing/carinaai.uk/_footer-snippet.html` - canonical footer; copy verbatim
4. `frontends/marketing/carinaai.uk/pricing/index.html` - how plan cards and `.pricing-path` are built
5. `frontends/marketing/carinaai.uk/use-cases/index.html` - closest structural reference for this page

---

## Context

**What Aiva is:** An AI worker for UK businesses. Aiva = Artificially Intelligent Virtual Assistant.
Always written "Aiva" (title case). Every AI worker on the platform is an Aiva. VERLOX builds them.
Carina is the underlying agent engine. The brand stack: "Your Aiva, from VERLOX. Powered by Carina."

**Who this page is for:** Business owners who arrived from a Google search ("AI virtual assistant UK")
or a referral. They have never heard of Carina. They do not care about self-hosting or npm packages.
They want one thing: something that handles client conversations so they can sleep.

**What this page must not do:**
- Mention self-hosting, MIT licensing, or npm
- Use the words "AI-powered", "machine learning", or "LLM" anywhere
- Use the word "chatbot" except once, in the hero headline, negated ("Not another chatbot.")
- Show pricing figures (prices are not finalised; link to `/pricing/` instead)
- Use em dashes (`--`, `---`) anywhere - use `:`, `;`, `,`, or sentence breaks
- Use any emoji

**One primary CTA throughout:** "Start free" linking to `https://app.carinaai.uk/register`.
Secondary ghost links may appear but never compete with the primary.

---

## File structure

Single HTML file: `frontends/marketing/carinaai.uk/aiva/index.html`

Page-specific styles go in an inline `<style>` block in `<head>`. Do not create new `.css` files.
Do not modify `vertical.css` or `style.css`. Follow the same pattern as `pricing/index.html`.

**`<head>`:**

```html
<title>Hire an Aiva | VERLOX</title>
<meta name="description" content="Aiva answers your clients on WhatsApp, Email, Slack, and web chat around the clock. Trained on your business. Backed by a human VA team. Free for 15 days.">
<link rel="canonical" href="https://carinaai.uk/aiva">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Instrument+Sans:wght@300;400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css">
<link rel="stylesheet" href="/vertical.css">
```

---

## Page sections in order

Build these sections top to bottom. Each has its own `<section>` tag and a comment in the HTML.

---

### Section 1: Nav

Copy `_nav-snippet.html` verbatim. Add one link between "Use cases" and "Security":

```html
<a href="/aiva/" class="aiva-nav-link">Aiva</a>
```

In the inline `<style>` block:

```css
.aiva-nav-link { color: var(--amber); font-weight: 500; }
.aiva-nav-link:hover { color: var(--white); }
```

Add this link to the mobile nav panel inside the snippet as well.

---

### Section 2: Hero

Full-width section. Dark navy background. Two-column layout on desktop (55% left, 40% right, 5% gap).
Single column stacked on mobile (text above, conversation card below).

**Left column - copy:**

```
[eyebrow - small caps, --silver color, --ff-sans, 0.72rem, letter-spacing 0.08em]
Aiva by VERLOX

[h1 - Cormorant Garamond 500, 56px desktop / 36px mobile, line-height 1.15]
Hire a worker.
Not another chatbot.

[p - Instrument Sans 300, 1.05rem, --silver]
Aiva answers your clients on WhatsApp, email, and web
chat around the clock. It knows your business because
you trained it. When it should not answer alone, it
hands off to a human.

[CTA row - margin-top: 2rem]
<a href="https://app.carinaai.uk/register" class="btn btn-primary">Start free</a>
<a href="#how-it-works" class="btn btn-ghost">See how it works</a>
```

`btn-primary` and `btn-ghost` classes exist in `vertical.css`. Use them as-is.

**Right column - conversation mock card:**

A static HTML card. Not animated. No JavaScript.

```html
<div class="conv-mock">
  <div class="conv-mock-header">
    <i class="ti ti-brand-whatsapp"></i>
    <span class="conv-mock-name">Aria</span>
    <span class="conv-mock-time">2:14 am</span>
  </div>
  <div class="conv-mock-body">
    <div class="conv-bubble conv-bubble--user">
      What are your rates for a full detail?
    </div>
    <div class="conv-bubble conv-bubble--aiva">
      Hi! Full detail is £85 and takes about 90 min.
      Want to book this week?
    </div>
    <div class="conv-bubble conv-bubble--user">
      Yes please, Saturday?
    </div>
    <div class="conv-bubble conv-bubble--aiva">
      Saturday at 10am works. Sending you a confirmation now.
    </div>
  </div>
  <div class="conv-mock-caption">While you slept.</div>
</div>
```

CSS for the conversation card in the inline `<style>` block:

```css
.conv-mock {
  background: rgba(13, 31, 45, 0.7);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  overflow: hidden;
  max-width: 340px;
}

.conv-mock-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border-dim);
  font-size: 0.82rem;
}

.conv-mock-header .ti { color: #25D366; font-size: 1rem; }
.conv-mock-name { font-weight: 500; }
.conv-mock-time { margin-left: auto; color: var(--silver); }

.conv-mock-body { padding: 1rem; display: flex; flex-direction: column; gap: 0.6rem; }

.conv-bubble {
  padding: 0.55rem 0.85rem;
  border-radius: 12px;
  font-size: 0.875rem;
  line-height: 1.5;
  max-width: 85%;
}

.conv-bubble--user {
  background: rgba(26, 95, 122, 0.22);
  border: 1px solid var(--border-dim);
  align-self: flex-end;
  border-bottom-right-radius: 3px;
}

.conv-bubble--aiva {
  background: rgba(245, 166, 35, 0.08);
  border: 1px solid rgba(245, 166, 35, 0.15);
  align-self: flex-start;
  border-bottom-left-radius: 3px;
}

.conv-mock-caption {
  padding: 0.5rem 1rem 0.75rem;
  font-size: 0.75rem;
  color: var(--silver);
  text-align: center;
  font-style: italic;
}
```

---

### Section 3: Three pillars

Heading: none (no `<h2>` needed; the cards carry themselves).

Three cards, horizontal flex row on desktop, stacked on mobile.
Use `.hub-card` from `vertical.css` if it provides a clean bordered card. If not, use:

```css
.pillar-card {
  flex: 1;
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: 1.5rem;
  background: rgba(13, 31, 45, 0.4);
}
.pillar-card h3 {
  font-family: var(--ff-serif);
  font-size: 1.2rem;
  font-weight: 500;
  margin-bottom: 0.6rem;
}
.pillar-card p {
  font-size: 0.9rem;
  color: var(--silver);
  line-height: 1.65;
  margin: 0;
}
```

Card 1:
```
h3: Always on
p:  Answers on WhatsApp, Email, Slack, Telegram, and web chat.
    No shifts. No holidays. No missed messages.
```

Card 2:
```
h3: Knows your business
p:  Train it with your documents, FAQs, and product notes.
    It stays in character and uses your information accurately.
```

Card 3:
```
h3: Knows when to stop
p:  The moment it is uncertain, it escalates to a human.
    Every time. Without being asked.
```

---

### Section 4: How it works

Section id: `how-it-works`
Section heading: "How it works" (h2, Cormorant Garamond 500)

Use the `.pricing-path` + `.pricing-path-node` + `.pricing-path-num` pattern from `pricing/index.html`.
Three steps in a bordered box with amber-circled numbers.

**Step 1 - Choose a role**
Body: "Pick from a template or describe your business in your own words. Customer service.
Bookings. Sales. Property enquiries. Done in two minutes."

**Step 2 - Connect your channels**
Body: "WhatsApp, Email, Slack, Telegram, or web chat. Connect one now and add more at any time.
Your Aiva gets its own contact on every channel you choose."

**Step 3 - Go live**
Body: "Your Aiva starts answering in minutes. It introduces itself to each new contact and
maintains context across every conversation."

After the three steps, a muted note:
```
When your Aiva should not answer alone, it hands off to a trained human from the VERLOX team.
You see the outcome. You do not see the handoff.
```

---

### Section 5: Role templates

Section heading: "Pick a role" (h2)
Section id: `roles`

Six cards in a CSS grid: `grid-template-columns: repeat(3, 1fr)` on desktop,
`repeat(2, 1fr)` at 768px, `1fr` below 480px.

Each card has:
- A Tabler icon (1.4rem, `color: var(--teal-light)`)
- Role name (h3, 1rem, Instrument Sans 500)
- A single example user question in a small blockquote style (0.82rem, --silver, italic)
- A small Aiva reply below it (0.82rem, amber tint, not italic)
- A ghost link "Try this role" pointing to `https://app.carinaai.uk/register?role=[slug]`

Hover state: on hover, the card border brightens to `var(--teal-light)` and the example
blockquote gains `max-height` from 0 to full via CSS transition (no JS). This means the
question and reply are visible on hover desktop and always visible on mobile.

```css
.role-card {
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: 1.25rem;
  background: rgba(13, 31, 45, 0.4);
  transition: border-color 0.18s ease;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.role-card:hover { border-color: var(--teal-light); }

.role-example {
  overflow: hidden;
  max-height: 0;
  transition: max-height 0.25s ease;
}
@media (max-width: 768px) {
  .role-example { max-height: none; }
}
.role-card:hover .role-example { max-height: 120px; }

.role-example-q {
  font-size: 0.82rem;
  color: var(--silver);
  font-style: italic;
  border-left: 2px solid var(--border);
  padding-left: 0.6rem;
  margin: 0 0 0.35rem;
}
.role-example-a {
  font-size: 0.82rem;
  color: rgba(245, 166, 35, 0.75);
  padding-left: 0.6rem;
}
.role-try {
  margin-top: auto;
  font-size: 0.8rem;
  color: var(--silver);
  text-decoration: none;
}
.role-try:hover { color: var(--amber); }
```

Six roles:

| Role | Icon | Slug | Example question | Aiva reply (truncated) |
|------|------|------|-----------------|------------------------|
| Customer service | `ti-headset` | `customer_service` | "Do you offer next-day delivery?" | "Yes, next-day is available on orders before 2pm..." |
| Booking assistant | `ti-calendar-event` | `booking` | "Can I book a table for Saturday?" | "Saturday evening works. How many guests?" |
| Sales qualifier | `ti-target` | `sales` | "What does your service include?" | "Happy to walk you through it. What size is your team?" |
| Property enquiry | `ti-building` | `property` | "Is the flat on Park Road still available?" | "It is. Want to book a viewing this week?" |
| Tech support | `ti-tool` | `tech_support` | "My login is not working, can you help?" | "I can sort that. What email do you use to log in?" |
| Custom role | `ti-plus` | `custom` | amber border card | "Describe your business in your own words." |

The "Custom role" card has `border-color: rgba(245,166,35,0.3)` by default and `var(--amber)` on hover.
Its link goes to `https://app.carinaai.uk/register` without a role param.
Its body text: "Describe your business in your own words. Your Aiva is configured from your description."

---

### Section 6: Channels

Section heading: "Works where your clients already are" (h2)

Five items in a flex row on desktop, wrapping to 2-3 on smaller screens.

Each item:
- Tabler icon (1.6rem, `color: var(--teal-light)`)
- Channel name (small caps, 0.75rem, Instrument Sans 500, letter-spacing 0.06em)
- One-line description (0.85rem, --silver)

```
ti-brand-whatsapp   WhatsApp
                    Clients message on their phone.
                    Your Aiva replies in the thread.

ti-mail             Email
                    Your Aiva gets its own inbox.
                    Replies land in their email thread.

ti-brand-slack      Slack
                    Lives in your team channels.
                    Knows the context before it replies.

ti-brand-telegram   Telegram
                    Full two-way messaging.
                    Works in groups and direct messages.

ti-message          Web chat
                    Embed on any site with one line of code.
                    Served from core.carinaai.uk/widget.js.
```

No borders on these items. Simple flex layout with sufficient gap.

---

### Section 7: Automation examples

Section heading: "Set it once. It runs." (h2)
Subheading (muted, Instrument Sans 300): "Describe a recurring process and it runs on schedule.
Even when you are offline."

Three cards in a flex row on desktop, stacked on mobile.

Each card (`border: 1px solid var(--border)`, `border-radius: var(--r-md)`, `padding: 1.25rem`):
- A workflow chain: 3 small step badges connected by `->` arrows
- A schedule badge (small pill, teal tint)
- A quote from a hypothetical user (italic, --silver, 0.85rem)

Step badge CSS:
```css
.step-badge {
  display: inline-block;
  font-size: 0.72rem;
  padding: 0.2rem 0.55rem;
  background: rgba(26, 95, 122, 0.12);
  border: 1px solid var(--border);
  border-radius: 4px;
  white-space: nowrap;
}
.step-arrow { color: var(--silver); font-size: 0.7rem; margin: 0 0.2rem; }
.schedule-badge {
  display: inline-block;
  font-size: 0.72rem;
  padding: 0.2rem 0.55rem;
  background: rgba(245, 166, 35, 0.08);
  border: 1px solid rgba(245, 166, 35, 0.2);
  border-radius: 4px;
  color: var(--amber);
  margin-top: 0.75rem;
}
```

Card 1 - Property inbox:
- Chain: `Read overnight messages` -> `Categorise by urgency` -> `Send morning briefing`
- Schedule: "Every day at 8 am"
- Quote: "I wake up to a sorted inbox. The urgent ones are already flagged."

Card 2 - Invoice sweep:
- Chain: `Check completed jobs` -> `Issue invoices` -> `Flag unpaid from last week`
- Schedule: "Every Friday at 5 pm"
- Quote: "Billing closes itself now. Nobody touches it manually."

Card 3 - Prospect follow-up:
- Chain: `Day 1: intro email` -> `Day 3: check-in` -> `Day 5: warm close`
- Schedule: "Triggered on new lead"
- Quote: "Three-touch follow-up runs end to end. We just see the replies."

One line in muted text below the cards:
"Your Aiva uses judgment on every step. It does not break when something unexpected happens."

---

### Section 8: Trust

Section id: `trust`

This section has a distinct background to mark it as a separate zone:

```css
.trust-section {
  background: rgba(26, 95, 122, 0.08);
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  padding: 5rem 0;
}
```

**Top of section:**

```
[h2 - Cormorant Garamond 500, 44px]
Every Aiva is watched.

[p - Instrument Sans 300, 1.05rem, --silver, max-width 520px]
Not by you. By us. Three layers of oversight are built into every plan.
No add-ons. No separate contracts.
```

**Below the heading, two-column layout on desktop (prose left, table right):**

Left column - three numbered paragraphs:

```
1. Human backup, always included.

   Every Aiva has a confidence threshold. When a task is ambiguous, emotional,
   or outside its scope, it escalates. A trained human from the VERLOX VA team
   picks up where the Aiva left off. No extra fee. No separate contract.

2. Scout monitors every action.

   Every message sent, every tool called, every automation run is reported to
   Scout: VERLOX's AI governance layer. Scout watches for rogue behavior, volume
   spikes, and repeated failures. If something looks wrong, Scout pauses the Aiva
   before your client sees the problem.

3. Every action is on the blockchain.

   A cryptographic hash of every Aiva action is attested on-chain the moment it
   happens. The record is permanent and independently verifiable. If a regulator
   or auditor asks what your AI did on a given date, you can prove it without
   relying on anyone's logs.
```

Style: each paragraph has a small amber circled number using the same `.pricing-path-num` style.

Right column - comparison table:

| | Pure AI tools | Aiva from VERLOX |
|--|--|--|
| Fails on edge cases | No fallback | Human VA steps in |
| Goes rogue | No guardrail | Scout monitors; kill switch active |
| Audit trail | Partial logs | Full record on every action |
| Verifiable by regulators | No | On-chain hash; independently provable |
| Oversight cost | Add-on or none | Included in every plan |

Table styling: `border-collapse: collapse`, cells `1px solid var(--border)`,
"Aiva from VERLOX" column header has `color: var(--amber)`.

Muted note below the table:
"Blockchain attestation uses content hashes only. No client data is stored on-chain."

Ghost link below the section:
`How Scout works ->` linking to `https://labyrinthscout.com`

---

### Section 9: Pricing preview

Section heading: "Simple pricing" (h2)

Three plan cards in a row. Smaller and lighter than the full pricing page cards.
Do not show prices. Prices are not finalised.

Card structure (each):
- Plan name (h3, Instrument Sans 500)
- Subtitle (muted, e.g. "1 Aiva")
- Feature list (4-5 items, small bullet points)
- No CTA button on individual cards

**Starter** - subtitle: "1 Aiva"
- 2,000 messages per month
- Email and one messaging channel
- Human VA oversight included
- Scout monitoring
- Blockchain audit trail

**Team** - subtitle: "Up to 5 Aivas" - add `border-color: var(--teal-light)` and a
"Most popular" badge (`background: rgba(26,95,122,0.15); color: var(--teal-light); font-size: 0.72rem`):
- Everything in Starter
- 10,000 messages per month
- 5 Aivas
- Analytics dashboard
- Scout fleet view

**Business** - subtitle: "Unlimited Aivas" - add `border-color: rgba(245,166,35,0.3)`:
- Everything in Team
- Unlimited messages
- White-label (your brand, your domain)
- Custom Aiva training (documents and FAQs)
- Custom Scout governance rules

Below the three cards, centered, muted text with link:
"Full pricing including Carina Core and Scout plans: [/pricing/]"

---

### Section 10: Final CTA

Full-width band. Background: `rgba(26, 95, 122, 0.06)`. Border-top: `1px solid var(--border)`.

Centered content, `max-width: 560px`, `padding: 5rem 2rem`:

```
[h2 - Cormorant Garamond 500, 44px]
Your first Aiva is free for 15 days.

[p - Instrument Sans 300, --silver]
No card required. Cancel any time.
Backed by the VERLOX VA team from day one.

[btn-primary]  Start free  ->  https://app.carinaai.uk/register

[ghost link, small]  Talk to us first ->  mailto:hello@verlox.uk
```

Below the buttons, a slim attribution strip using the existing badge SVGs:

```html
<div class="brand-attribution">
  <img src="/assets/badges/powered-by-carina.svg" alt="Powered by Carina" height="20">
  <span class="brand-sep">·</span>
  <span class="brand-text">Monitored by Scout</span>
</div>
```

```css
.brand-attribution {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  justify-content: center;
  margin-top: 2rem;
  opacity: 0.45;
}
.brand-sep { color: var(--silver); }
.brand-text { font-size: 0.75rem; color: var(--silver); }
```

---

### Section 11: Footer

Copy `_footer-snippet.html` verbatim. Add "Aiva" to the product links column in the footer,
pointing to `/aiva/`.

Also add "Privacy Policy" and "Terms" links to the footer legal row, pointing to `/privacy/`
and `/terms/` (these pages are built by prompt 21).

---

## Update `_nav-snippet.html`

Add the Aiva link to the desktop nav and the mobile nav panel in `_nav-snippet.html`.
This is the only file outside `aiva/` that this prompt should modify.

Position: between "Use cases" and "Security" in the nav link list.

```html
<a href="/aiva/" class="aiva-nav-link">Aiva</a>
```

The `.aiva-nav-link` style is page-specific on this page; for the global nav snippet, add
the rule to the `<style>` block in `_nav-snippet.html` itself so all pages that embed the
snippet inherit it.

---

## Done When

**File and structure:**
- [ ] `frontends/marketing/carinaai.uk/aiva/index.html` exists and renders without errors
- [ ] Uses `/vertical.css` only; no new `.css` files created
- [ ] Nav copied verbatim from `_nav-snippet.html`; "Aiva" link added and active-highlighted
- [ ] Footer copied verbatim from `_footer-snippet.html`; "Aiva" and legal links added
- [ ] `_nav-snippet.html` updated with the Aiva link (only file outside `aiva/` modified)

**Hero:**
- [ ] Two-column layout on desktop; single-column stacked on mobile
- [ ] "Hire a worker. Not another chatbot." headline in Cormorant Garamond
- [ ] Conversation mock card renders as static HTML with WhatsApp icon, 2:14am timestamp, 4 bubbles
- [ ] User bubbles right-aligned with teal tint; Aiva bubbles left-aligned with amber tint
- [ ] "While you slept." caption renders below the card
- [ ] Primary CTA links to `https://app.carinaai.uk/register`

**Three pillars:**
- [ ] Three bordered cards in a flex row; stack on mobile
- [ ] "Always on", "Knows your business", "Knows when to stop" copy correct

**How it works:**
- [ ] Three steps use `.pricing-path` pattern from `pricing/index.html`
- [ ] Amber numbered circles match the pricing page style
- [ ] Muted human handoff note renders below the three steps

**Role templates:**
- [ ] Six cards in a 3/2/1 column responsive grid
- [ ] Hover state reveals the example conversation (CSS `max-height` transition, no JS)
- [ ] Always visible on mobile (no hover required)
- [ ] "Try this role" links include `?role=[slug]` param
- [ ] Custom role card has amber border treatment

**Channels:**
- [ ] Five channel items with correct Tabler icons
- [ ] Each has channel name and one-line description

**Automation examples:**
- [ ] Three cards with step badge chains and `->` arrows
- [ ] Schedule badges styled with amber tint
- [ ] Quotes in italic muted text
- [ ] "Uses judgment on every step" note below cards

**Trust section:**
- [ ] Teal-tinted background zone with top/bottom borders
- [ ] "Every Aiva is watched." headline in Cormorant Garamond 44px
- [ ] Three numbered paragraphs with amber number circles
- [ ] Comparison table renders with amber "Aiva from VERLOX" column header
- [ ] Blockchain privacy note in muted text below table
- [ ] "How Scout works ->" ghost link to labyrinthscout.com

**Pricing preview:**
- [ ] Three plan cards with no prices shown
- [ ] Team card has "Most popular" badge and teal-light border
- [ ] Business card has amber-tint border
- [ ] Link to `/pricing/` below cards

**Final CTA:**
- [ ] "Your first Aiva is free for 15 days." in Cormorant Garamond 44px
- [ ] Start free button links to `https://app.carinaai.uk/register`
- [ ] "Talk to us first" ghost link present
- [ ] Brand attribution strip with Carina badge SVG and "Monitored by Scout" text

**Copy rules:**
- [ ] No em dashes anywhere (not in copy, not in comments, not in attributes)
- [ ] No emojis anywhere
- [ ] The word "chatbot" appears exactly once (hero headline, negated)
- [ ] No prices anywhere on the page
- [ ] No competitor names in any user-visible text
- [ ] No mention of "AI-powered", "machine learning", or "LLM"
