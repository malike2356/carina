# Carina self-improving learning loop -- Prompt 02 of 05: Skill synthesizer

## Task

Turn an approved learning candidate into one reusable artifact.

The artifact can be a skill, prompt delta, policy note, fallback rule, or memory rule, but it must have one clear purpose.

## Hard rules

- Keep the artifact narrow.
- Do not duplicate existing coverage.
- Do not include secrets.
- Do not include raw conversation text.
- Do not expand scope beyond the approved candidate.
- Prefer operational clarity over creativity.

## Inputs

- candidate_title
- candidate_summary
- candidate_evidence
- existing_artifacts
- toolset_available
- platform_constraints

## Output

Return JSON only:

```json
{
  "name": "kebab-case",
  "description": "one sentence",
  "applies_when": ["phrase 1", "phrase 2"],
  "inputs_needed": ["input 1", "input 2"],
  "steps": ["step 1", "step 2", "step 3"],
  "fallbacks": ["fallback 1", "fallback 2"],
  "do_not": ["restriction 1", "restriction 2"],
  "validation": ["how to verify this works"],
  "content": "full body under 500 words"
}
```

If the candidate is too weak, return empty fields:

```json
{
  "name": "",
  "description": "",
  "applies_when": [],
  "inputs_needed": [],
  "steps": [],
  "fallbacks": [],
  "do_not": [],
  "validation": [],
  "content": ""
}
```

