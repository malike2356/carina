# Carina Enterprise

Carina Enterprise is VERLOX Ltd commercial support for companies building products on the **MIT Carina kernel**. It follows the Red Hat model: the software is free; you pay for production support, services, and SLAs.

Public overview: [carinaai.uk/enterprise](https://carinaai.uk/enterprise).

:::warning Not a license change
Enterprise is a **services contract**. The kernel stays MIT. You can self-host, fork, and ship without Enterprise. Nothing here grants VERLOX ownership of your product code.
:::

---

## Who it is for

| Audience | Typical need |
|----------|--------------|
| ISVs | Ship a vertical product ("Powered by Carina") without rebuilding agent infrastructure |
| Regulated teams | GDPR or NHS DSPT-aligned deployments with guided documentation |
| Platform engineering | One kernel, many internal agents, coordinated upgrades |

Enterprise overlaps **Carina Ops Team** (hosted multi-user SaaS) but adds builder support, custom packs, and negotiated SLAs. It is not a replacement for **Labyrinth Scout** security subscriptions; see [Scout pricing](https://labyrinthscout.com#pricing) for governance products.

---

## Offering components

### Support SLAs

- Email support with optional dedicated Slack channel
- Severity-based response targets (**Custom SLA**; negotiated per contract)
- Do not treat marketing copy as binding SLA numbers until your MSA is signed

### Dedicated instances

- Single-tenant Carina Cloud or private VPC deployment
- Customer-controlled upgrade windows
- Useful when multi-tenant Cloud is not acceptable for data residency

### Custom domain packs

- VERLOX or partner-built vertical packs under contract
- Includes skills, optional RAG corpus, evaluation notes, and publish path to Hub or private registry
- See [Build your first domain pack](/docs/developer/first-domain-pack) for the DIY path

### Compliance assistance

- GDPR data-flow mapping for Carina memory, BYOK, and hosted schemas
- NHS DSPT-oriented checklists for UK health pilots (e.g. COMPASS-style decision support)
- Audit-ready documentation templates

**Not legal advice.** Your Data Protection Officer and counsel must sign off for production use in regulated environments.

### Training

- Kernel architecture and semver migration workshops
- Domain pack development sessions for your engineers
- Remote by default; on-site available by arrangement

---

## Comparison

| | Self-host (MIT) | Carina Cloud | Carina Enterprise |
|---|---|---|---|
| Kernel license | MIT | MIT (hosted) | MIT + support contract |
| Support | Community | Standard hosted | Custom SLA |
| Custom packs | DIY | Self-serve | Contract build |
| Dedicated hosting | Your infra | Shared tenant | Single-tenant option |

Current commercial packaging: [carinaai.uk/pricing](https://carinaai.uk/pricing).

---

## Scout Enterprise (separate)

Agent security (injection shield, audit, kill switch, trust API) is **Labyrinth Scout**, a separate commercial product:

- [labyrinthscout.com](https://labyrinthscout.com)
- Docs: [Labyrinth Scout](/docs/user/security/labyrinth-scout)

Enterprise support contracts may **coordinate** Scout integration but do not bundle Scout unless explicitly stated in your order form.

---

## Proof points

Distros on the kernel today:

- [Propreneur case study](https://carinaai.uk/case-studies/propreneur/) (Powered by Carina)
- [Flitz case study](https://carinaai.uk/case-studies/flitz/) (Built on Carina)
- [COMPASS case study](https://carinaai.uk/case-studies/compass/) (Powered by Carina, in development)

---

## Contact

Email **hello@carinaai.uk** with:

- Company name and product URL (if any)
- Use case and regulated context (if applicable)
- Team size and target timeline

VERLOX will respond with a discovery call invite. Commercial terms are finalized in the quote and order form.

---

## Badge

Enterprise customers may display the **Carina Enterprise Supported** badge when their contract includes co-marketing rights:

![Carina Enterprise Supported](https://carinaai.uk/assets/enterprise-supported-badge.svg)

This badge is **not** the same as "Powered by Carina" or "Built on Carina" partner badges. See [Partner program](/docs/developer/partner-program). Do not use the Enterprise badge without a signed Enterprise agreement.

---

## Related docs

- [Commercial boundaries](/docs/user/pricing)
- [Carina Cloud](/docs/user/carina-cloud)
- [Carina Ops plans](/docs/user/carina-ops/plans)
- [Labyrinth Scout](/docs/user/security/labyrinth-scout)
- [Manifesto](/docs/developer/manifesto)
