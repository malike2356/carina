# Gap 09 - Prompt 09: Supply Chain Dependency Pinning

> **REUSE RULE:** See `../REUSE-RULES.md`. Implement the behavior below in Carina's own voice. No competitor product names, labels, CLI text, UI copy, or config key names may appear verbatim in shipped code. Rename all user-visible elements to Carina equivalents before committing.


**Agent:** Codex (package.json edits + GitHub Actions)
**Estimated hours:** 2-3 hrs
**Depends on:** Nothing - standalone security hygiene

---

## The Problem

In May 2026, the `litellm` package (a Python LLM routing library) was compromised in a supply
chain attack. A fake "Mini Shai-Hulud" worm spread through packages that pinned only lower bounds
(`>= 1.x`) rather than upper bounds (`>= 1.x, < 2.0`). Any package that did `npm update` or
`pip install --upgrade` pulled the malicious version automatically.

Carina's `package.json` files likely use standard npm semver syntax (`^1.2.3`) which allows
minor and patch upgrades. This is fine for most cases, but for security-critical packages (AI
clients, CLI tools that write files, packages with network access) it leaves Carina exposed.

Hermes responded to this by auditing all dependencies and adding upper bounds to packages
where a compromised new version could cause damage.

---

## Read First

```
core.carinaai.uk/package.json           (main package)
app.carinaai.uk/package.json            (Next.js app)
console.labyrinthscout.com/package.json (Scout)
carinaMobile/package.json               (mobile)
```

---

## 1. Audit and Pin Critical Packages

In `core.carinaai.uk/package.json`, identify packages in these categories and add upper bounds:

**Category A: AI/LLM clients (highest risk - direct API access)**
```
@anthropic-ai/sdk
openai
@google/generative-ai
groq-sdk
```

**Category B: CLI tools with file system write access**
```
ts-node
tsx
vitest
esbuild
```

**Category C: Network/HTTP clients**
```
axios
node-fetch
undici
got
```

**Category D: Authentication/Crypto packages**
```
jsonwebtoken
bcrypt
bcryptjs
argon2
```

For each of these, change from:
```json
"@anthropic-ai/sdk": "^0.52.0"
```
to:
```json
"@anthropic-ai/sdk": ">=0.52.0 <1.0.0"
```

The upper bound is set to the NEXT major version (since major bumps are usually breaking anyway).
For packages already at major version 1+, pin to next major:
```json
"openai": ">=4.x.x <5.0.0"
```

---

## 2. Script to Audit Current Pinning

Run this to see which packages use `^` (unbounded minor) vs exact or range:

```bash
# In core.carinaai.uk/
node -e "
const pkg = require('./package.json');
const deps = { ...pkg.dependencies, ...pkg.devDependencies };
const unbounded = Object.entries(deps)
  .filter(([, v]) => v.startsWith('^'))
  .map(([k, v]) => \`  \${k}: \${v}\`);
console.log('Packages with unbounded ^ semver:');
console.log(unbounded.join('\n'));
console.log(\`Total: \${unbounded.length}\`);
"
```

---

## 3. Package Lock Commit Policy

Add a note to CLAUDE.md or a dev checklist (not code):

After adding or upgrading any package:
1. Run `pnpm install` to update `pnpm-lock.yaml`
2. Commit `pnpm-lock.yaml` with the dependency change in the same commit
3. Never run `pnpm update --latest` without reviewing what changed

---

## 4. GitHub Actions Pinning

All GitHub Actions used in CI workflows should be pinned to commit SHAs, not tag names.
Tag names like `@v3` can be moved by the action author.

Find all workflow files:
```bash
find .github/workflows -name "*.yml" | xargs grep "uses:" | grep -v "@[0-9a-f]\{40\}"
```

Any line matching `uses: actions/checkout@v4` should become:
```yaml
uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
```

To find the correct SHA for a given tag:
```bash
gh api repos/actions/checkout/git/refs/tags/v4.2.2 --jq '.object.sha'
```

---

## 5. Dependabot Config

Create `.github/dependabot.yml` to get automated PRs for security updates:

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/core.carinaai.uk"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 5
    labels:
      - "dependencies"
      - "security"
    # Allow only patch-level auto-merges; minor/major require review
    groups:
      patch-updates:
        update-types:
          - "patch"

  - package-ecosystem: "npm"
    directory: "/app.carinaai.uk"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 3

  - package-ecosystem: "npm"
    directory: "/console.labyrinthscout.com"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 3

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5
```

---

## 6. pnpm Audit Script

Add to `core.carinaai.uk/package.json` scripts:

```json
{
  "scripts": {
    "audit:security": "pnpm audit --audit-level=high",
    "audit:licenses": "npx license-checker --onlyAllow 'MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC;0BSD' --excludePrivatePackages"
  }
}
```

Run `pnpm audit:security` in CI to block PRs with high-severity vulnerabilities.

---

## 7. Specific Pinning for Most Critical Packages

Here are the exact changes to make in `core.carinaai.uk/package.json`:

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": ">=0.52.0 <1.0.0",
    "openai": ">=4.0.0 <5.0.0",
    "better-sqlite3": ">=11.0.0 <12.0.0",
    "jsonwebtoken": ">=9.0.0 <10.0.0",
    "express": ">=4.18.0 <5.0.0"
  },
  "devDependencies": {
    "typescript": ">=5.0.0 <6.0.0",
    "vitest": ">=2.0.0 <3.0.0",
    "tsx": ">=4.0.0 <5.0.0"
  }
}
```

After editing, run `pnpm install` to update the lockfile.

---

## Files to Modify

```
core.carinaai.uk/package.json           pin critical packages with upper bounds
app.carinaai.uk/package.json            pin AI/auth packages
console.labyrinthscout.com/package.json pin AI/auth packages
carinaMobile/package.json               pin AI packages
.github/dependabot.yml                  create (new file)
.github/workflows/*.yml                 pin GitHub Actions to SHAs
```

---

## Done When

- [ ] `@anthropic-ai/sdk`, `openai`, and other AI clients have upper-bound ranges
- [ ] `jsonwebtoken`, `bcrypt`, auth packages have upper-bound ranges
- [ ] `pnpm audit:security` script added and returns 0 vulnerabilities
- [ ] `.github/dependabot.yml` is in place for automated security PRs
- [ ] All GitHub Actions in `.github/workflows/` use commit SHA pinning, not tag names
- [ ] `pnpm-lock.yaml` is committed (lockfile integrity)
- [ ] A comment in CLAUDE.md documents the pinning policy and the May 2026 incident context
- [ ] Running `pnpm install` after the changes works without errors