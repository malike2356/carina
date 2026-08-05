# Carina self-improving learning loop -- Prompt 05 of 05: Post-write regression tester

## Task

Test a newly written artifact against known scenarios and failure cases.

## Checks

- happy path
- near miss
- duplicate overlap
- unsafe overreach
- missing input
- tool failure
- stale instruction conflict

## Inputs

- artifact_text
- artifact_type
- known_related_files
- sample_scenarios
- unsafe_cases

## Output

Return JSON only:

```json
{
  "pass": true,
  "issues": [],
  "recommended_patch": "short patch summary",
  "merge_ready": true
}
```

If the artifact fails, list the issues and keep merge_ready false.

