# Prompt 04: CLI Skill Publish Commands

## Context

Developers building custom skills need a CLI workflow to publish their skills to the Hub
and submit them to the public marketplace. The CLI handles packing, validation, upload,
and status checking.

## What to Build

### 1. `carina skills publish` command

Publish a skill to the user's private hub (available to their own Carina instance):
```bash
carina skills publish ./my-skill/         # publish from directory
carina skills publish ./my-skill.ts       # publish single file
carina skills publish --name my-skill     # publish named skill from ~/.carina/skills/
```

Implementation in `src/cli/skills.ts`:
```typescript
skillsCmd
  .command('publish')
  .description('Publish a skill to your Carina instance')
  .argument('[path]', 'Path to skill file or directory')
  .option('--name <name>', 'Skill name (if not specified in skill file)')
  .action(async (path, opts) => {
    // 1. Load skill from path
    const skill = await loadSkillFromPath(path);

    // 2. Run security scan
    const findings = await scanSkill(skill.content);
    reportFindings(findings);

    if (findings.some(f => f.severity === 'critical')) {
      console.error('Publish blocked: critical security findings must be resolved first.');
      process.exit(1);
    }

    // 3. Upload to Carina core
    const result = await post('/api/skills/publish', { skill });
    console.log(`Published: ${skill.name} v${skill.version}`);
  });
```

### 2. `carina skills submit` command

Submit a skill to the public marketplace (triggers peer review):
```bash
carina skills submit ./my-skill/        # submit for review
carina skills submit --name my-skill    # submit previously published skill
```

```typescript
skillsCmd
  .command('submit')
  .description('Submit a skill to the public Carina Skills Hub for review')
  .argument('[path]', 'Path to skill')
  .action(async (path, opts) => {
    const skill = await loadSkillFromPath(path);
    const findings = await scanSkill(skill.content);

    if (findings.some(f => f.severity === 'critical')) {
      console.error('Submission blocked: critical findings present. Fix them first.');
      process.exit(1);
    }

    const result = await post('https://core.carinaai.uk/api/marketplace/submit', { skill });
    console.log(`Submitted for review. Submission ID: ${result.submissionId}`);
    console.log('Check status: carina skills status ' + result.submissionId);
  });
```

### 3. `carina skills status` command

Check the review status of a submitted skill:
```bash
carina skills status <submission-id>
```

Output:
```
Skill: my-skill v1.0.0
Submitted: 2026-06-15T08:14:32Z
Status: needs-review
Findings: 1 MEDIUM
Reviewer comment: (none yet)
```

### 4. Skill pack file format

A publishable skill is a TypeScript/JavaScript file with a default export conforming to the
`SkillDefinition` type:
```typescript
export default {
  name: 'my-skill',
  version: '1.0.0',
  description: 'What this skill does',
  author: 'Your name or handle',
  category: 'security',    // must be a valid pack category
  permissions: ['memory:read', 'web:fetch'],
  prompts: [
    {
      name: 'main',
      content: 'You are helping with...',
    },
  ],
  tools: ['web-search', 'read-file'],  // existing tools this skill uses
} satisfies SkillDefinition;
```

### 5. Validation command

```bash
carina skills validate ./my-skill.ts    # validate format and scan
```

Output:
```
Validating my-skill.ts...
Format: OK
Permissions: OK (memory:read, web:fetch are valid)
Security scan: 1 MEDIUM finding
  Line 23: External call to api.example.com (not whitelisted)

Skill is valid but has warnings. Run `carina skills submit` to submit for review.
```

## Verification Checklist

- [ ] `carina skills publish ./my-skill.ts` uploads skill to local Carina instance
- [ ] Publish with critical finding exits with error message
- [ ] `carina skills submit` uploads to marketplace and returns submission ID
- [ ] `carina skills status <id>` shows current review status
- [ ] `carina skills validate` runs without uploading and shows findings

## Files to Create or Modify

- MODIFY `src/cli/skills.ts` - add publish, submit, status, validate subcommands
- CREATE `src/skills/pack-loader.ts` - load skill from file path
- MODIFY `src/api/marketplace.ts` - add submit and status endpoints
