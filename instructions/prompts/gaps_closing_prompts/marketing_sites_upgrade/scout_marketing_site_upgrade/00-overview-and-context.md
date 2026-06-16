# Labyrinth Scout Marketing Site Upgrade - Overview and Context

## What this series is

A complete redesign of `labyrinthscout.com/index.html` from its current state to the final approved positioning.

There are 5 prompts in this series numbered 01 through 05. Execute them in order. Each prompt is self-contained.

## Current state problems

The current `labyrinthscout.com/index.html` (435 lines, separate `style.css`) has the following issues:

1. The hero headline is "Your AI agent can act. Scout makes it accountable." This is an interesting line but it does not land the positioning. "Accountable" is a governance-adjacent word that undersells what Scout actually does.
2. The hero badge says "Autonomous Agent Governance" - this is correct category language but buries the emotional hook. Visitors see compliance language before they feel the fear that makes them buy.
3. There is no mention of "Mission Control for Autonomous Agents" which is the approved sub-position.
4. The blockchain/on-chain attestation section (Section: Verification) leads with ERC-8004 and ERC-8126 terminology. This is a risk-before-benefit ordering problem for non-technical buyers.
5. The page structure interleaves features (monitoring, injection, approvals, kill switch) without building emotional tension first. The Kill Switch is buried as the last item in a 9-card features grid.
6. The positioning table ("Security Tools Detect. Scout Governs.") is the most powerful copy on the current site and is not present.
7. "Observe. Verify. Control." - the approved tagline - is not used prominently anywhere.

## Approved final positioning (do not change these)

- Tagline: Observe. Verify. Control.
- Sub-position: Mission Control for Autonomous Agents
- Hero headline: AUTONOMOUS AGENTS ARE POWERFUL. WHO'S IN CONTROL?
- Section order: Hero - Kill Switch - Trust Passport - Injection Shield - Governance (with comparison table) - Final CTA
- Visual identity: red/amber authority palette, distinct from Carina's green

## File locations

- Marketing site: `/opt/lampp/htdocs/verlox/carina/labyrinthscout.com/index.html`
- Existing stylesheet: `/opt/lampp/htdocs/verlox/carina/labyrinthscout.com/style.css`
- Existing JS: `/opt/lampp/htdocs/verlox/carina/labyrinthscout.com/app.js`

Strategy: The redesign replaces `index.html` completely (inline CSS). The `style.css` and `app.js` files remain untouched - the new `index.html` will NOT link `style.css` (the new inline styles supersede it). The new `index.html` WILL keep the `app.js` link since that file handles the radar animation and copy buttons.

## Design system for Scout

```css
:root {
  --bg:           #06090f;
  --bg-lift:      #0b0e17;
  --bg-card:      #0f1420;
  --border:       rgba(255,255,255,0.06);
  --border-mid:   rgba(255,255,255,0.10);
  --red:          #e63946;
  --red-dim:      rgba(230,57,70,0.10);
  --red-glow:     rgba(230,57,70,0.20);
  --amber-warn:   #f59e0b;
  --green-safe:   #22c55e;
  --cyber:        #22d3ee;
  --text-primary: #f0f4f8;
  --text-mid:     #7a8fa6;
  --text-dim:     #3d5060;
  --silver:       var(--text-mid);
  --ff-sans:      'Inter', system-ui, sans-serif;
  --r:            6px;
  --r-md:         10px;
  --r-lg:         16px;
  --transition:   200ms cubic-bezier(0.4,0,0.2,1);
}
```

The primary accent is `--red` (#e63946), not green. This communicates authority, risk, and control - the correct emotional register for Scout. Secondary: amber for warnings, green for SAFE status only.

## Psychology of the Scout landing page

Scout sells fear reduction. The visitor is someone responsible for AI systems in production who is afraid of what happens when an agent is wrong, compromised, or out of control.

Every section must answer one of three questions:

1. What can go wrong? (Fear setup)
2. What does Scout do when it does? (Product answer)
3. How do I know it worked? (Evidence)

Do not lead with features. Lead with control. Then show the features as the mechanism of control.

## Deployment

After editing: `bash /opt/lampp/htdocs/verlox/carina/scripts/deploy-marketing.sh`

Do not deploy until all 5 prompts are complete and the page has been reviewed in a browser.
