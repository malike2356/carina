# University partnership kit (internal)

VERLOX outreach script for lecturers and module leads. Public-facing page: [University program](https://carinaai.uk/docs/developer/university-program) (share this URL with students).

**Status:** Platform access and mentorship TBD. Do not promise paid internships, funding, or official university endorsement without written agreement.

---

## Elevator pitch (30 seconds)

Carina is a free, MIT-licensed **agent OS kernel** built in Portsmouth, UK. Students install it locally, build **domain packs** (vertical skills + optional RAG knowledge), and publish to the Skills Hub or npm. The kernel handles tools, memory, model routing, and channels; coursework focuses on domain design, evaluation, and responsible AI boundaries. Scout (commercial security) and Carina Ops (hosted SaaS) are optional add-ons; coursework uses the free core only.

---

## What we offer

| Offer | Detail |
|-------|--------|
| **Carina core** | Free forever (MIT). Self-host or use student laptops. |
| **Curriculum hooks** | Mapped modules below (UG, MSc, research). |
| **Tutorial** | [Build your first domain pack](https://carinaai.uk/docs/developer/first-domain-pack) (~30 min). |
| **Contribution path** | [CONTRIBUTING](https://github.com/malike2356/carina-agent/blob/main/CONTRIBUTING.md), good first issues, GitHub Discussions. |
| **VERLOX office hours** | Monthly slot for module leads (schedule TBD). |
| **Mentorship** | Informal code review on PRs; no guaranteed 1:1 hours until capacity confirmed. |

We do **not** offer by default: paid internships, grants, university co-branding, or Scout/Carina Ops credits unless separately agreed.

---

## Suggested modules

### Undergraduate (UG)

**Title:** Hello domain pack  
**Duration:** 2 to 4 weeks  
**Outcome:** Working pack in `~/.carina/packs/`, demo in `carina chat`

1. Follow [first domain pack tutorial](https://carinaai.uk/docs/developer/first-domain-pack).
2. Extend hello-pack with one extra skill (student's choice of domain).
3. Submit PR or Discussions post with screenshot and `pack.json`.

**Assessment ideas:** manifest validation, skill trigger coverage, short reflective report on kernel vs pack boundary.

### MSc / postgraduate

**Title:** Vertical pack with RAG and evaluation  
**Duration:** one term  
**Outcome:** Pack with `knowledge/` corpus, `carina ingest`, eval harness run

1. Pick a topic from [dissertation pack ideas](https://carinaai.uk/docs/developer/_examples/dissertation-pack-ideas) (public doc).
2. Build 5+ skills, 20+ knowledge markdown files (synthetic or public-domain sources only).
3. Run `carina eval` / pack eval gate; document precision/recall or qualitative review.
4. Optional: `carina pack publish` to dev hub with publish key.

**Assessment ideas:** corpus quality rubric, eval report, ethics appendix (no real PII).

### Research / dissertation

**Title:** Agent platform comparison  
**Outcome:** Paper or dissertation chapter comparing Carina, LangChain-style frameworks, MCP-only stacks

Axes: tool registry, memory backends, channel adapters, pack modularity, security boundary (Scout optional), license and self-host cost.

Data: reproducible benchmarks on same task set (cite Carina version).

---

## Primary contact

**Email:** hello@carinaai.uk  
**Public program page:** https://carinaai.uk/docs/developer/university-program  
**Community:** https://carinaai.uk/community/

---

## What VERLOX needs from the university

Before scheduling office hours or custom onboarding:

1. **Module lead name** and department  
2. **Approximate student count** per cohort  
3. **Academic calendar** (start/end, assessment deadlines)  
4. **Lab constraints** (offline only, GPU, Windows/Mac mix)  
5. **Data policy** confirmation: no real patient, client, or classified data in packs (GDPR)

---

## Outreach email template

Subject: Carina agent kernel for [Module Name] student projects (MIT, Portsmouth-built)

Hello [Name],

I am writing from VERLOX Ltd, builders of Carina (https://carinaai.uk), an MIT-licensed agent kernel developed in Portsmouth. We are inviting UK universities to use Carina for student projects in AI, software engineering, and domain-specific agent design.

Students install the free core, build **domain packs** (skills + optional knowledge), and can contribute back via GitHub. We provide a 30-minute tutorial, contribution guides, and are planning monthly office hours for module leads (schedule TBD).

Public overview for you to forward: https://carinaai.uk/docs/developer/university-program

If useful, I would welcome a short call to align on cohort size and timeline.

Best regards,  
[Name]  
VERLOX Ltd  
hello@carinaai.uk

---

## GDPR and ethics (mandatory talking points)

- Do **not** put real patient, client, or employee data in pack knowledge files.  
- Use synthetic examples, public legislation, or anonymised scenarios only.  
- Carina core is self-hosted; students are data controllers for what they load into local RAG.  
- Scout/Carina Cloud are separate commercial products; not required for coursework.

---

## University branding

Do not imply **official University of Portsmouth (or any institution) endorsement** unless a formal partnership agreement exists. Approved wording: "Student project using Carina" or "Coursework built on the Carina kernel."

Suggested academic npm scope (optional, not enforced by tooling): `@uop/pack-<slug>` for University of Portsmouth student publishes; document in dissertation ideas.

---

## Success metrics (internal)

Target from strategy: **3 to 5 external contributors** from university partnerships in Phase 3.

Track: Discussions introductions, pack PRs tagged `university` or `good first issue`, module lead meetings booked.

---

## Related prompts and docs

- Prompt 16: first domain pack tutorial  
- Prompt 01: manifesto  
- `docs/kernel/good-first-issues/`  
- Public export: `malike2356/carina-agent`
