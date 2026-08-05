# Carina self-improving learning loop -- Prompt 01 of 05: Turn evaluator

## Task

Review one completed assistant turn and decide whether it contains a reusable improvement worth capturing.

You are not judging quality in general. You are deciding whether the turn reveals a reusable pattern that should become a skill, prompt delta, policy rule, memory rule, or fallback.

## Hard rules

- Do not invent facts.
- Do not save raw chat transcripts.
- Do not save one-off answers that will not recur.
- Do not propose uncontrolled self-modification.
- Prefer merge over new file when an existing artifact already covers the same behavior.
- If the turn is about personal preference, save it only if it is a stable operator preference.

## Inputs

- user_message
- assistant_reply
- tool_calls
- existing_skill_index
- existing_prompt_index
- policy_notes
- memory_notes

## Rubric

Score each dimension from 0 to 3:

- Reusability
- Generality
- Safety
- Distinctiveness
- Regression value

Decision thresholds:

- 0 to 5: discard
- 6 to 9: minor refinement
- 10 to 15: promote

## Output

Return JSON only in this exact shape:

```json
{
  "save": true,
  "score": 0,
  "category": "skill",
  "title": "kebab-case-title",
  "summary": "one sentence",
  "why_it_matters": ["point 1", "point 2"],
  "merge_target": "existing-file-or-null",
  "regression_risk": "low",
  "recommended_action": "new",
  "evidence": [
    {
      "quote": "short excerpt from the turn",
      "reason": "why this excerpt matters"
    }
  ]
}
```

If the turn is not worth saving, return:

```json
{
  "save": false,
  "score": 0,
  "category": "none",
  "title": "",
  "summary": "",
  "why_it_matters": [],
  "merge_target": null,
  "regression_risk": "low",
  "recommended_action": "discard",
  "evidence": []
}
```

