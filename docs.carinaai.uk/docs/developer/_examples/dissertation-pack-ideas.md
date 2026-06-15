# Dissertation and MSc project ideas (domain packs)

Use these as starting briefs. Adapt scope to your module marking rubric. All examples assume **synthetic or public-domain data only** (no real patients, clients, or classified material).

## Naming convention (optional)

University teams may publish npm packages as:

```
@<institution-slug>/pack-<topic>
```

Examples for University of Portsmouth:

- `@uop/pack-healthcare-demo`
- `@uop/pack-legal-research`

Carina Hub slugs stay kebab-case (`healthcare-uk-demo`). The `@uop/` prefix is documentation only; the toolchain does not enforce it.

---

## 1. healthcare-uk pack (MSc)

**Goal:** Skills that help navigate **public** NHS and UK health **information** (not diagnosis or treatment).

**Skills (examples):**

- `find-nhs-service`: signpost to NHS.uk pages by symptom category (informational only)
- `glossary-term`: explain common UK healthcare acronyms (GP, ICB, NHS 111)
- `appointment-prep`: checklist of questions for a GP visit (generic)

**Knowledge corpus:** 15 to 30 markdown files from NHS.uk, GOV.uk (cite sources). No real patient stories.

**Evaluation:** 20 test prompts; measure correct refusal when asked for medical diagnosis.

**Ethics section required:** disclaimers, limits of agent advice, GDPR note.

---

## 2. legal-uk pack (MSc / LLM)

**Goal:** Research assistant for **public** UK legislation and tribunal **summaries** (not legal advice).

**Skills:**

- `act-summary`: summarize a named Act section from legislation.gov.uk
- `defined-term`: explain a term from a provided statute excerpt
- `source-citation`: always return URL to primary source

**Knowledge:** Public Acts, secondary guidance (open government licence). No client matter files.

**Evaluation:** citation accuracy on held-out section IDs; refusal test for "represent me in court" prompts.

---

## 3. education pack (UG / MSc)

**Goal:** Teaching assistant for **formative** learning (not graded exam answers).

**Skills:**

- `lesson-outline`: generate session plan from learning objectives
- `quiz-writer`: multiple-choice from supplied reading list only
- `feedback-rubric`: map draft essay to provided rubric dimensions

**Knowledge:** Course reading list PDFs (with permission), open textbooks, lecturer-authored notes.

**Deliverable:** demo with `ACTIVE_SKILL_PACKS=education-demo` in `carina chat`.

---

## 4. local gov pack (MSc)

**Goal:** Help residents find **public** council services (bins, planning portal, councillor contact).

**Skills:**

- `service-router`: map postcode area to council website section (use open data)
- `jargon-plain`: explain planning terms in plain English
- `foi-template`: draft FOI request template (generic)

**Knowledge:** One council's public web content (e.g. Portsmouth City Council open pages). No casework data.

**Evaluation:** route accuracy on 15 synthetic resident queries.

---

## 5. sustainability pack (UG / research)

**Goal:** Carbon literacy assistant using **open** datasets.

**Skills:**

- `unit-converter`: kWh to kg CO2e with stated factors (cite DEFRA or similar open tables)
- `behaviour-tip`: actionable household tips with source links
- `data-chart-describe`: describe trends from provided CSV (no fabricated statistics)

**Knowledge:** DEFRA conversion factors (public), IPCC summary snippets (with attribution).

**Research angle:** compare pack+RAG vs plain LLM on factual consistency tests.

---

## Platform comparison dissertation (research)

**Question:** How do agent kernels differ from framework-only stacks?

**Compare:** Carina (`carina-agent`), a LangChain/LangGraph baseline, MCP-only tool server.

**Metrics:** setup time, tool invocation latency, memory persistence, channel swap effort, license cost for 100-seat lab.

**Reproducibility:** pin versions, publish pack + config in appendix.

---

## Submission checklist

- [ ] `pack.json` passes [stable API](/docs/developer/stable-api) validation
- [ ] No em-dashes in user-facing pack copy (house style)
- [ ] Ethics / GDPR appendix
- [ ] README with install steps for marker
- [ ] Optional: Hub tarball or `@org/pack-*` npm package

Contact for module registration: hello@carinaai.uk
