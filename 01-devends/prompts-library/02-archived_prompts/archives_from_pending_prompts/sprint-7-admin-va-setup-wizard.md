# Sprint 7 - Admin First-Time Setup Wizard (admin.carinaai.uk)

**Status: COMPLETED 2026-06-25**

**What was built:**
- `src/components/va/VaTeamSetupWizard.tsx` (3-step empty-state wizard)
- `src/app/(admin)/va-queue/page.tsx` (team tab wiring, `teamLoading` state)

## Context and what already exists

The admin frontend at `03-frontends/client-apps/admin.carinaai.uk/` is a Next.js 15 app
running on port 4200. It has a complete VA Queue page, login/TOTP auth, and sidebar navigation.
Do not rebuild any of that. This prompt is about one specific gap: the empty state when no
VA team members exist.

When an admin logs in for the first time, the VA Queue page (`/va-queue`, team tab) shows:

```
No team members configured.
```

That blank message is not enough for a non-techy operator who just set up Carina and needs
to hand conversations to a real person. They need a guided first-time setup that walks them
through adding their first team member without requiring any prior knowledge.

## What to build

Build a `VaTeamSetupWizard` component at:

```
src/components/va/VaTeamSetupWizard.tsx
```

It renders in place of the empty team table when `team.length === 0 && !loading`. Three
screens, managed with a local `step` state (no routing, no external state):

### Screen 1: Explain what's happening

Heading: "Add your first team member"

Body copy:
"When your Aiva cannot help a customer, it hands the conversation to a real person on your
team. Before that can happen, you need to add at least one person here."

One button: "Add someone now" - advances to screen 2.

### Screen 2: The add form

Plain text labels. No jargon.

Fields:
- "Their name" (text input, required, placeholder: "e.g. James")
- "Their email" (email input, required, placeholder: "e.g. james@yourcompany.com")
- "How many conversations can they handle at once?" (number input, min 1, max 20, default 5)

Below the number input, a small hint line:
"We suggest starting with 5. You can change this any time."

Two buttons: "Add them" (submits, calls `POST /api/admin/va/team`) and "Back" (returns to
screen 1).

On submit: show a loading state on the button ("Adding..."), handle errors by showing the
API error message inline (no toast, inline is clearer for a wizard), on success advance to
screen 3.

### Screen 3: Done

Heading: "Ready."

Body copy (replace NAME with the name entered in step 2):
"NAME has been added. When your Aiva needs help, it will notify NAME directly."

One button: "Go to the queue" - calls the `onComplete` prop callback (the parent reloads
the team list and switches the view back to the main team table).

## Props

```typescript
interface VaTeamSetupWizardProps {
  onComplete: () => void;
}
```

## Where to plug it in

File: `src/app/(admin)/va-queue/page.tsx`

In the `tab === 'team'` section, the current check that shows the empty table is:

```tsx
{team.length === 0 && loading ? (
  <TableSkeleton rows={5} cols={8} />
) : (
  // ... table
)}
```

Add a new branch before the table: if `team.length === 0 && !loading` and `!showAddForm`,
render `<VaTeamSetupWizard onComplete={() => { void loadTeam(); }} />` instead of the table.

When `showAddForm` is open (the small inline add form already on the team tab), keep
showing that. The wizard only renders when both `team.length === 0` and `!showAddForm`.

The "+ Add team member" button at the top of the team tab should remain; some users may
prefer the raw form over the wizard. The wizard is an empty-state replacement, not a
replacement for the existing form.

## Styling constraints

- Match the existing dark Tailwind theme: `bg-elevated`, `bg-overlay`, `border-border`,
  `text-text-primary`, `text-text-muted`, `text-danger`
- Amber accent: `text-amber-400`, `bg-amber-500/20`
- Button classes already in globals.css: `btn-admin-primary`, `admin-input`
- No additional packages needed

## Copy constraints (REUSE-RULES.md applies)

- No em dashes (use commas or sentence breaks)
- No emojis anywhere
- Calm, direct tone: "Added." not "Team member added successfully!"
- No competitor product names in any string

## Done when

- `VaTeamSetupWizard.tsx` renders correctly when no team members exist
- Screen 1 explains the concept in plain English
- Screen 2 submits to `/api/admin/va/team` (POST) and handles errors inline
- Screen 3 shows the added name and has a working "Go to the queue" button
- After `onComplete` fires, the team table reloads and shows the new member
- The existing "+ Add team member" button still works independently
- TypeScript compiles: `pnpm build` passes with no errors

## Post-build (MANDATORY)

See `POST-BUILD-CHECKLIST.md` in this directory. Move this file to
`02-archived_prompts/archives_from_pending_prompts/` when done.
