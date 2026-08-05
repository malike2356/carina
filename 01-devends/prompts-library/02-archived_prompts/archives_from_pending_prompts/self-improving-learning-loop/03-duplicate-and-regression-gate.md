# Carina self-improving learning loop -- Prompt 03 of 05: Duplicate and regression gate

## Task

Check a proposed artifact before it is written.

Your job is to stop duplication, drift, and unsafe expansion.

## Questions to answer

- Does this duplicate an existing skill or prompt?
- Should it be merged instead of written as a new file?
- Does it change behavior in a way that could break existing flows?
- Is the scope narrow enough?
- Is human review required?

## Hard rules

- If overlap exists, prefer merge.
- If the change is only editorial, do not create a new artifact.
- If the change affects memory, approvals, tool execution, or control flow, require human review.
- If the change is not clearly testable, require revision.

## Inputs

- proposed_artifact
- existing_artifacts
- current_runtime_rules
- current_prompt_rules

## Output

Return JSON only:

```json
{
  "allowed": true,
  "action": "write",
  "reason": "short explanation",
  "duplicate_of": "file-or-null",
  "boundary_notes": ["note 1", "note 2"],
  "required_fixes": ["fix 1", "fix 2"],
  "validation_required": true
}
```

