# Prompt 05; admin UI controls

You are working in the Carina front end and settings surfaces. Your task is to expose incident blog automation controls in ops.

Primary goal:

- Let operators configure discovery, approval, publish, and newsletter behavior from the UI
- Keep the controls easy to understand and hard to misuse

Scope:

- Update the settings UI in:
  - `carina/03-frontends/client-apps/app.carinaai.uk/src/app/(workspace)/settings/page.tsx`
  - related settings components if needed
- Surface controls for:
  - research schedule
  - auto-approve threshold
  - auto-publish mode
  - newsletter mode
  - recent research runs
  - draft counts and send counts

UI requirements:

- Use the existing settings style and components where possible
- Make the default behavior visibly conservative
- Show concise help text for each automation control
- Make it obvious how to turn automation off

Output required:

1. UI controls for incident blog automation
2. Any API wiring needed to read and save the settings
3. Tests or manual verification notes for the new controls

Constraints:

- Do not hide the default manual review path
- Do not make auto-publish the default
- Keep the UI consistent with the rest of ops settings

Acceptance criteria:

- Operators can configure automation from the admin UI
- The current research and dispatch state is visible
- The controls match the actual backend behavior

