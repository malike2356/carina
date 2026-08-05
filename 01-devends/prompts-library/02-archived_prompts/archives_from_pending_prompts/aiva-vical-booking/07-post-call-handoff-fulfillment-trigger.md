# Post-call handoff and fulfillment trigger

Build the handoff after the discovery call.

## Scope

- Add a post-call outcome flow:
  - qualified
  - proposal needed
  - needs follow-up
  - not a fit
  - won
  - lost
- If qualified, create the next action automatically.
- If proposal needed, create a draft task for fulfillment or sales follow-up.
- If won, trigger onboarding or fulfillment workflow.
- If not a fit, close the lead cleanly and preserve history.
- Add a call notes area and outcome selector.
- Add integration hooks for invoices, documents, and task creation.

## Deliverables

- Post-call outcome model
- Outcome form
- Workflow triggers
- Task generation hooks
- Tests for outcome transitions and trigger behavior

## Acceptance criteria

- After a call, the lead moves to a meaningful next state.
- Fulfillment or sales follow-up can begin without manual re-entry.
- History remains intact.
