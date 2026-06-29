# Built on Carina partner program

Public program page: [carinaai.uk/partners](https://carinaai.uk/partners).

The partner program is for companies and teams **shipping products on the MIT Carina kernel**. It provides co-marketing, official badges, and a path to featured placement. It is free to apply; human review is required (no self-service badge in v1).

Partnership does **not** change the kernel license and does **not** mean VERLOX endorses your product claims.

---

## Program tiers

| Tier | Requirements | Benefits |
|------|--------------|----------|
| **Registered** | Product uses Carina in production or active pilot; link back to carinaai.uk | Partners page listing; approved badge use |
| **Featured** | Production deployment plus published case study | Homepage showcase; `/case-studies/` page; docs cross-links |
| **Strategic** | Revenue share or [Carina Enterprise](/docs/user/enterprise) contract | Co-marketing, early RFC access, priority support |

---

## Badge guidelines

Download SVGs from [carinaai.uk/partners](https://carinaai.uk/partners). Minimum display width: **120px**. Do not recolor or rewrite badge text.

| Badge | When to use |
|-------|-------------|
| **Powered by Carina** | Your product uses the Carina kernel in production for agent execution (tools, memory, routing). |
| **Built on Carina** | You ship a substantial custom layer (distro) on top of the kernel: vertical UI, domain packs, and ops your team owns. |
| **Secured by Scout** | Only if Labyrinth Scout is integrated in production. Badge from [labyrinthscout.com](https://labyrinthscout.com), not this program. |
| **Carina Enterprise Supported** | Only with a signed Enterprise contract. See [Enterprise](/docs/user/enterprise). |

Full rules: [BRAND_RULES.md](https://github.com/malike2356/carina-mutant/blob/main/core.carinaai.uk/docs/kernel/BRAND_RULES.md) in the repository.

### Which badge should I request?

- **Propreneur-style SaaS** where Carina is the agent engine: **Powered by Carina**
- **Flitz / ABBIS-style distros** with heavy custom product surface: **Built on Carina**
- When unsure, describe your architecture in the application; VERLOX assigns the badge

---

## Application checklist

Before emailing hello@carinaai.uk:

1. **Public URL** where we can verify the product exists (staging OK if access instructions included)
2. **Kernel depth**: which package (`carina-agent`), packs, channels, and memory backend
3. **Carina version** or git tag you track against
4. **Customer value prop** in one paragraph (what the product does, not kernel internals)
5. **Link back**: where you will link to [carinaai.uk](https://carinaai.uk) (footer, about page, or docs)
6. **Case study permission** (yes/no) for Featured tier
7. **Honest status**: production, pilot, or in development

Subject line: `Carina partner application`

---

## Marketing obligations

Partners agree to:

- Link to [carinaai.uk](https://carinaai.uk) from a public page (footer, about, or docs)
- Use the correct badge label (Powered by vs Built on)
- State product status honestly (do not claim "production NHS" unless true)
- Not imply VERLOX acquired, invests in, or guarantees your product
- Not use the Carina wordmark as your primary product logo

VERLOX may revoke partner status if badges are misused or claims are misleading.

---

## Founding partners (reference)

| Product | Badge | Tier | Status |
|---------|-------|------|--------|
| [Propreneur](https://carinaai.uk/case-studies/propreneur/) | Powered by Carina | Featured | Production |
| [Flitz](https://carinaai.uk/case-studies/flitz/) | Built on Carina | Registered | In development |
| [COMPASS](https://carinaai.uk/case-studies/compass/) | Powered by Carina | Featured | In development |
| ABBIS | Built on Carina | Registered | Coming soon |

---

## FAQ

**Is there a fee?** Registered and Featured tiers are free. Strategic tier may include Enterprise commercial terms.

**How long does review take?** Typically 5 to 10 business days.

**Can open-source projects apply?** Yes, if there is a clear product surface and public URL.

**Premium Hub packs?** Separate from partner program; see [Selling a pack](/docs/developer/selling-a-pack).

---

## Related docs

- [Manifesto](/docs/developer/manifesto)
- [First domain pack](/docs/developer/first-domain-pack)
- [Carina Enterprise](/docs/user/enterprise)
- [Platform architecture](/docs/developer/platform-architecture)
