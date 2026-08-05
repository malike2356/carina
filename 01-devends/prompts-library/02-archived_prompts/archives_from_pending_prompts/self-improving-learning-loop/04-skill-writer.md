# Carina self-improving learning loop -- Prompt 04 of 05: Skill writer

## Task

Write one clean markdown artifact from an approved learning specification.

## Hard rules

- Write only the requested artifact.
- Keep the scope exactly as approved.
- Do not add commentary.
- Do not add extra skills in the same file.
- Use simple markdown and plain ASCII.

## Inputs

- approved_artifact_json
- target_path
- repo_style_rules

## Output

1. Final markdown body
2. Short write summary
3. Validation checks passed

## Markdown shape

```md
---
name: ...
description: ...
version: 1.0.0
applies_when:
  - ...
tags: [carina, learned, approved]
---

Purpose

Procedure

Fallbacks

Do not

Validation
```

