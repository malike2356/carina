# Propreneur Features from Bernadette Anderson's IPN Talk

**Source:** IPN event 7 May 2026 -- Bernadette Anderson, Property Deal of the Year winner
**Context:** Development-focused portfolio (flips, conversions, extensions, HMOs). Her talk was about the real challenges behind the wins.

---

## 1. Development Deal Calculator (New)

**What she experienced:**
- Development loan terms varied wildly between lenders (rates, fees, drawdown schedules)
- Had to model £20k interest difference on a fixed-rate expiry decision manually
- Lender valuation shortfall (£725k vs expected £850k) -- needed to model the impact on her returns

**What Propreneur should have:**
A dedicated **development finance calculator** (beyond current BTL/BRR/HMO):

| Input | What it models |
|---|---|
| Purchase price + SDLT + legals | Total acquisition cost |
| Build cost (phased by month) | Drawdown schedule |
| GDV (optimistic / base / pessimistic) | Exit scenarios |
| Interest rate + arrangement fee + exit fee | True cost of finance |
| Timeline (months to complete) | Interest accrual during build |
| Equity injection from partners | Waterfall distribution |

**Outputs:**
- Gross profit, net profit after finance costs
- Return on equity
- Sensitivity table (what happens if GDV drops 10%?)
- Cashflow by month during the build phase
- Interest accrual visualisation (how much is lost per month of delay?)

**Carina integration:** Carina can answer: *"What's my return if the valuation comes in at £725k instead of £850k?"*

---

## 2. Contractor Management Module (New)

**What she experienced:**
- Vetted, replaced, and managed 10+ contractors across multiple projects
- Used manual quote comparison (Excel)
- Had to fire contractors mid-project (disrespect, poor quality, theft of equipment)
- Experienced warranty void issues (boiler set to wrong temp by contractor)
- Caught mistakes daily because she was on site (wrong shower position, bad door gaps)

**What Propreneur should have:**

| Feature | Detail |
|---|---|
| **Contractor Directory** | Per-user/workspace directory of vetted contractors with ratings, trades, insurance expiry, accreditations |
| **Quote Comparison** | Structured quote form (itemised) -- compare side-by-side. Not just free-text notes. |
| **Project Budget Tracker** | Budget per project phase vs actual invoices received. Flag overruns early. |
| **Snagging/Defect List** | Per-project. Photo, description, assigned to contractor, status, date resolved. |
| **Site Diary** | Daily / weekly log entries -- photos, what was done, issues found, decisions made. |
| **Contractor Performance** | Track: on-time delivery, quality issues, communication, would-hire-again rating. |
| **Warranty Tracker** | Per-installation warranty expiry dates (boiler, electrics, roof, fire doors). |

**Carina integration:** *"Who did I use for plumbing on Project X?"* / *"Add a snag: back bedroom door gap too large. Assign to John the builder."*

---

## 3. Valuation Evidence Hub (New)

**What she experienced:**
- Lender valued at £725k. She knew it was worth more but had no direct comparable.
- Eventually appealed and won by showing evidence from similar properties.
- Had to go over the valuer's head to the head of lending to get the valuation reviewed.

**What Propreneur should have:**

A per-property **Valuation Evidence Store**:
- Store comparables (sold prices, rental evidence) by postcode/area
- Link to Property Filter or Rightmove data via API
- Upload valuation reports, RedBook assessments
- Track valuation vs purchase price vs GDV on every deal
- Timeline of valuations per property (initial valuation -> appeal -> final)

**Why this matters for Carina:** Carina can pull up comparables when a user asks *"What's my property worth?"* and flag *"Your last valuation was £725k. These 3 similar properties sold for £800k+ in the last 6 months."*

---

## 4. Cross-Collateralisation Warning (Architecture/Policy)

**What she experienced:**
- A development lender tried to include a clause allowing them to take rights across ALL her assets.
- She refused. "I never agreed to that. One SPV per deal. Something goes wrong with one, they can't touch the others."
- She never went to bed worrying because she structured properly.

**What Propreneur should implement:**

**Asset/SPV Register** -- A visual map of:
- Which assets sit in which company (SPV)
- Which lenders have security over which assets
- Flags when a new finance facility's terms would create cross-collateral risk
- Warning: *"This lender's terms would give them security over 3 other properties in this company. Consider a new SPV."*

**Policy/Audit:** Before marking a deal as *"financed"*, require confirmation that the user has reviewed cross-collateral terms. Audit log this decision.

---

## 5. Neighbour Engagement Tracker (New)

**What she experienced:**
- Got her extension approved by talking to the neighbour first, listening to concerns, adjusting plans.
- The neighbour could have appealed and blocked the whole project.
- "Relationships matter. If you put a good message out, ignore the trolls."

**What Propreneur should have:**

When a property has planning / development active:
- Track neighbour communications (who was notified, when, what was agreed)
- Before/after photos of neighbour-facing changes
- Document commitments made (hours of work, landscaping, boundary walls)
- Link to planning application reference

---

## 6. Multi-Project Dashboard (UI/UX Enhancement)

**What she experienced:**
- Multiple projects at different stages simultaneously
- "There's never a point where okay, this phase is finished and I'm moving to the next one. It's all happening at once."
- Juggled: small flips, a commercial conversion that fell through, a 16-unit conversion that got pulled, the house extension, an HMO.

**What Propreneur should enhance:**

The current pipeline/portfolio view should support a **developer dashboard**:
- One screen showing ALL projects with status: `Under Offer`, `Planning`, `Financing`, `Build Phase 1`, `Build Phase 2`, `Letting`, `Sold/Exited`
- Budget vs actual per project (at a glance)
- Time in each phase (flag if a project has been in "Planning" for 6+ months)
- Upcoming milestones across all projects
- Cashflow projection across all active projects (when does each need capital?)

---

## 7. Lender Relationship Log (New)

**What she experienced:**
- Went to the head of lending personally to appeal a valuation
- Had 4 different lenders offering different terms
- Development lenders are "not developers -- they're lenders. You have to educate them on your project."

**What Propreneur should have:**

A **lender register** per project:
- Which lenders approached
- Terms offered (rate, fee, LTV, drawdown schedule)
- Status (Declined, Pending, Approved, Drawn)
- Key contacts + relationship notes
- "This lender required 4 weeks for approval (promised 3)."

---

## 8. Automated Compliance Document Serving (Jeff's Idea -- Product Feature)

**What Jeff's talk revealed:**
- Landlords need to serve prescribed information (How to Rent, gas safety, EPC, EICR, etc.)
- Most use agents who get it wrong, creating ambiguity
- Digital evidence trail is the best defence

**What Propreneur should have:**

A **Compliance Dispatch Module**:
- Generate a property-specific email address per tenancy (e.g. `35chapelstreet@propreneur.uk`)
- Auto-forward replies, archive the sent documents
- Generate an N215-style declaration with metadata timestamp
- Store in the compliance log for that property
- Remind: *"Section 21 notice not valid without a current How to Rent guide link. Serve now?"*

---

## 9. Health / Workload Carina Feature (Quality of Life)

**What she experienced:**
- "I was really ill because I was doing everything at the same time. I had no time for myself."
- Now prioritises balance. "I actually get more done now."

**Carina policy:**
- Monitor conversation/tool usage patterns
- If a user runs 10+ deal calculations, schedules 3 sessions, creates 5 contacts, and sends emails all in one day: *"You've been at it a while. Want me to draft the summary and pick this up tomorrow?"*
- Optional quiet-hours mode (no non-urgent notifications after 8pm)

---

## Existing Propreneur Features Already Covered

| Feature | Exists? | Enhancement? |
|---|---|---|
| Deal calculators (BTL, BRR, HMO, SDLT, etc.) | Yes | Add Development Deal calculator |
| CRM / Contacts | Yes | Add Contractor type with rating/trade fields |
| Compliance tracking | Yes | Add compliance dispatch module (Jeff's S21 flow) |
| Pipeline Kanban | Yes | Add time-in-phase visibility, dev project stages |
| Property portfolio | Yes | Add SPV mapping, cross-collateral warnings |
| Mentoring OS | Yes | Not directly relevant, but Bernadette could be a mentor user |
| Carina AI agent | Yes | Add workload awareness, lender/vs-development logic |
| Carina calculator tool | Yes | Add development finance calculator tool |

---

## Priority Ranking for Build

| Priority | Feature | Effort | Impact |
|---|---|---|---|
|  High | Development deal calculator | Medium | Unlocks developer segment (larger deals, bigger fees) |
|  High | Contractor management module | Large | Differentiator -- no competitor does this well |
|  Medium | Valuation evidence hub | Small | Quick win -- just a document store per property |
|  Medium | Cross-collateral warning on SPV | Small | Policy/UI change, not much code |
|  Medium | Compliance dispatch (S21 email) | Medium | Directly addresses a landlord pain point |
|  Low | Neighbour engagement tracker | Small | Niche, but good for planning-heavy users |
|  Low | Multi-project dev dashboard | Medium | UI enhancement on existing pipeline |
|  Low | Workload health check (Carina) | Small | Quality-of-life differentiator |
