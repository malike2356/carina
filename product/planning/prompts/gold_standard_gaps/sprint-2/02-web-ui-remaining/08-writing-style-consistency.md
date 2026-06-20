# Prompt 08: Writing Style Consistency Enforcement

## Context

The hard rule from CLAUDE.md: no em dashes (U+2014), no en dashes (U+2013), no emojis.
This applies to all text in the codebase: UI strings, error messages, comments, markdown,
commit messages. Currently there is no automated check. Violations appear periodically
when AI-generated text is accepted without review.

This prompt builds two things: a linter that catches violations at CI time, and a
pre-save check for the ops admin panel's text content fields.

## What to Build

### 1. Text linter script

Create `scripts/check-writing-style.ts`:
```typescript
import { glob } from 'glob';
import { readFileSync } from 'fs';

const EM_DASH = ';';
const EN_DASH = '-';
const EMOJI_REGEX = /\p{Emoji_Presentation}|\p{Emoji}/gu;

const PATTERNS = [
  { pattern: EM_DASH, message: 'em dash (U+2014) - replace with; : , - or sentence break' },
  { pattern: EN_DASH, message: 'en dash (U+2013) - replace with - or number range' },
  { pattern: EMOJI_REGEX, message: 'emoji - replace with plain ASCII text label' },
];

// Check files: *.md, *.ts, *.tsx, *.ejs, *.html (exclude node_modules, dist, .git)
const files = await glob('**/*.{md,ts,tsx,ejs,html}', {
  ignore: ['node_modules/**', 'dist/**', '.git/**', 'archive/**'],
});

let violations = 0;
for (const file of files) {
  const content = readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const { pattern, message } of PATTERNS) {
      if (typeof pattern === 'string' ? lines[i].includes(pattern) : pattern.test(lines[i])) {
        console.error(`${file}:${i + 1}: ${message}`);
        violations++;
      }
    }
  }
}

if (violations > 0) {
  console.error(`\n${violations} writing style violations found.`);
  process.exit(1);
}
console.log('Writing style check passed.');
```

Add to `package.json` scripts:
```json
"check:style": "tsx scripts/check-writing-style.ts"
```

### 2. Pre-commit hook

Add to `.husky/pre-commit` (create if not present):
```bash
#!/bin/sh
pnpm check:style
```

Or add to `.github/workflows/ci.yml` as a CI step:
```yaml
- name: Writing style check
  run: pnpm check:style
```

### 3. Ops admin content validation

In `ops.carinaai.uk/middleware/writing-style.ts`:
```typescript
export function validateWritingStyle(text: string): string[] {
  const errors: string[] = [];
  if (text.includes(';')) errors.push('Contains em dash - replace with; : , - or sentence break');
  if (text.includes('-')) errors.push('Contains en dash - replace with hyphen');
  if (/\p{Emoji_Presentation}/gu.test(text)) errors.push('Contains emoji - use plain text label');
  return errors;
}
```

Apply this to the incident blog editor: before saving an incident body, run
`validateWritingStyle()` and show inline errors if violations are found.

### 4. Fix existing violations

After the linter is written, run it on the entire codebase and fix all violations before
committing the linter. Use the following substitution rules:
- ` - ` (spaced em dash) -> `; ` or `: ` depending on context
- ` - ` (spaced en dash) -> `-` (hyphen)
- Emoji icons in UI -> Tabler Icons SVG components (already in use)

## Verification Checklist

- [ ] `pnpm check:style` exits 0 on a clean codebase
- [ ] Add an em dash to a markdown file, run linter, see error with file:line reference
- [ ] Pre-commit hook blocks a commit that adds an em dash
- [ ] Incident blog editor shows inline error when em dash is typed in the body field

## Files to Create or Modify

- CREATE `scripts/check-writing-style.ts`
- MODIFY `package.json` - add check:style script
- CREATE `.husky/pre-commit` (or add step to `.github/workflows/ci.yml`)
- CREATE `ops.carinaai.uk/middleware/writing-style.ts`
- MODIFY `ops.carinaai.uk/views/incidents/edit.ejs` - add validation feedback
- FIX existing violations in all .md, .ts, .tsx, .ejs, .html files
