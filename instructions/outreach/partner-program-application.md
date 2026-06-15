# Partner program application rubric (internal)

VERLOX internal scoring for `hello@carinaai.uk` partner applications. Public page: [carinaai.uk/partners](https://carinaai.uk/partners). Developer doc: [partner-program](/docs/developer/partner-program).

**Do not auto-approve.** Every application needs a human decision logged in ops notes or email archive.

---

## Scoring (0 to 2 per dimension, max 10)

| Dimension | 0 | 1 | 2 |
|-----------|---|---|---|
| **Production status** | Idea only, no URL | Staging / pilot with access | Live production with users |
| **Kernel depth** | Carina mentioned only in marketing | Uses core + 1 pack or channel | Multiple packs, channels, or custom pack |
| **Vertical fit** | Generic chatbot wrapper | Valid vertical, weak differentiation | Clear vertical distro (property, health, logistics, etc.) |
| **Geographic diversity** | Duplicate of existing founding partner region + vertical | Adjacent market | New region or underserved vertical |
| **Marketing quality** | No link-back plan | Link-back promised | Link-back live + accurate badge choice |

**Tier assignment guide:**

| Total score | Suggested tier |
|-------------|----------------|
| 0 to 4 | Decline or ask for more info |
| 5 to 6 | Registered |
| 7 to 8 | Registered; invite case study for Featured |
| 9 to 10 | Featured (if case study committed) or Strategic discussion |

Strategic tier requires separate commercial conversation (Enterprise or revenue share). Do not promise Strategic in the first reply without founder approval.

---

## Badge assignment

| Signal | Badge |
|--------|-------|
| Carina is the agent runtime; product is mostly UI + domain config | **Powered by Carina** |
| Custom distro with significant code outside packs; own brand is primary | **Built on Carina** |
| Scout integrated in production | Add **Secured by Scout** (Scout team confirms) |

If applicant requests the wrong badge, reply with the correct label and rationale.

---

## Application email template (copy-paste)

**Subject:** Carina partner application

```
Product name:
Product URL:

Carina version / packages used (e.g. @verlox/carina-core, property-uk pack, Telegram channel):

Customer value prop (one paragraph):

Badge requested (Powered by Carina | Built on Carina):

Case study permission (yes/no):

Link back URL on your site (or where you will add it):
```

---

## Approve email template

```
Hello {name},

Thanks for applying to the Built on Carina partner program.

We approved {product} at the **{Registered|Featured}** tier with badge **{Powered by|Built on} Carina**.

Next steps:
1. Add a link to https://carinaai.uk on {page}.
2. Download badges from https://carinaai.uk/partners (minimum width 120px).
3. {If Featured: we will publish a case study draft for your review within {N} days.}

Partner listing: https://carinaai.uk/partners

This approval is marketing only; it does not change the MIT license or constitute VERLOX endorsement of {product} claims.

Best,
{your_name}
VERLOX Ltd
```

---

## Reject email template

```
Hello {name},

Thank you for your interest in the Built on Carina partner program.

We are not able to approve partner status at this time because {reason: insufficient public evidence of Carina usage | generic chatbot without kernel integration | misleading status claims | duplicate vertical without differentiation}.

You may reapply when:
- {specific condition, e.g. production URL live, case study draft ready, kernel integration documented}

Carina core remains free to use under MIT regardless of partner status.

Best,
{your_name}
```

---

## Common reject reasons

1. **No verifiable Carina usage** (marketing only mentions AI, not kernel)
2. **False production claims** (e.g. NHS live without evidence)
3. **Badge misuse requested** (Scout badge without Scout subscription)
4. **Trademark risk** (Carina as product name or implied acquisition)
5. **No link-back commitment**
6. **Clone of existing founding partner** with no geographic or vertical angle

---

## Founding partners (do not re-litigate badge)

| Product | Badge | Tier |
|---------|-------|------|
| Propreneur | Powered by Carina | Featured |
| Flitz | Built on Carina | Registered |
| COMPASS | Powered by Carina | Featured |
| ABBIS | Built on Carina | Registered |

---

## Related internal docs

- `instructions/outreach/enterprise-sales-one-pager.md`
- `instructions/outreach/university-partnership-kit.md`
- `core.carinaai.uk/docs/kernel/BRAND_RULES.md`
