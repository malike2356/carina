# Built on Carina certification

Automated path before human badge approval. Badges and copy rules: `docs/kernel/BRAND_RULES.md`.

## Levels

| Level | CLI | Use when |
|-------|-----|----------|
| Built on Carina | `carina certify built-on [path]` | Vertical product with significant custom layer on kernel |
| Powered by Carina | `carina certify powered-by [path]` | Product runs Carina kernel in production |
| Carina Enterprise Supported | Contract + manual review | Signed Enterprise agreement with VERLOX |

## Automated checks (built-on)

| Check | Required | What it verifies |
|-------|----------|----------------|
| kernel.integration | yes | `@verlox/carina-core`, carina scripts, or valid `pack.json` |
| pack.manifest | yes (packs) | `pack.json` name, author, description |
| kernel.boundary | yes | No imports of private ops/scout server URLs in source |
| docs.attribution | recommended | README mentions Carina |
| security.scout | recommended | Scout documented or `LABYRINTH_ENABLED` |

## Run certification

```bash
cd my-product
carina certify built-on .
carina certify built-on . --json > certification-report.json
```

Exit code 1 when required checks fail.

## After automated pass

1. Link to [carinaai.uk](https://carinaai.uk) from a public page.
2. Email hello@carinaai.uk with JSON report and product URL.
3. Human review for badge grant (typically 5 business days).

Badges do not imply VERLOX endorsement of regulatory, medical, or financial claims.

## Domain pack authors

Third-party packs should pass:

```bash
carina hub author init my-pack --author "Your Org"
carina hub publish ./packs/my-pack
```

Hub validator rejects credential patterns in knowledge markdown.

## Measurable proof

Benchmark task `certification.built_on` runs in CI to ensure the certification module stays shippable.
