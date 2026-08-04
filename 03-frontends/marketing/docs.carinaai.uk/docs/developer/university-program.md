---
sidebar_position: 5
---

# University program

Use Carina as the platform for student projects, dissertations, and AI coursework. The kernel is **MIT licensed** and **free forever**; your differentiation is the **domain pack** you build on top.

:::info Not an official endorsement
This page describes how educators and students may use Carina. It does not imply endorsement by the University of Portsmouth or any institution unless a separate agreement says so.
:::

## Overview

| Layer | Role in coursework |
|-------|-------------------|
| **carina-agent** | Tools, memory, channels, CLI (install locally) |
| **Domain pack** | Skills, prompt suffix, optional RAG knowledge (your project) |
| **Scout / Carina Ops** | Separate commercial products; not required for labs |

**Forward this page to students.** Lecturers: contact hello@carinaai.uk to register interest (module name, cohort size, calendar).

## Getting started (students)

```bash
npm install -g carina-agent
carina setup
carina doctor
```

Then complete **[Build your first domain pack](/docs/developer/first-domain-pack)** (~30 minutes).

## Suggested project levels

### Undergraduate

Build a **hello domain pack**, then add one custom skill for a topic you choose (sports analytics, campus FAQ, hobby domain). Deliverable: working pack under `~/.carina/packs/`, short demo in `carina chat`, optional GitHub PR.

### MSc / postgraduate

Build a **vertical pack** with:

- Valid `pack.json` manifest ([stable API](/docs/developer/stable-api))
- 5+ skills with clear triggers
- `knowledge/` markdown corpus (public or synthetic data only)
- `carina ingest <pack>` and basic evaluation notes

See [dissertation pack ideas on GitHub](https://github.com/malike2356/carina-mutant/blob/main/docs.carinaai.uk/docs/developer/_examples/dissertation-pack-ideas.md).

### Research

Compare agent platforms: Carina kernel vs LangChain-style stacks vs MCP-only designs. Focus on modularity, memory, tool boundaries, and self-host economics. Cite the Carina version you test against.

## Dissertation and project ideas

Five starter topics (expand in the ideas doc):

1. **healthcare-uk pack** (synthetic triage FAQ, not clinical advice)
2. **legal-uk pack** (public legislation summaries, not legal advice)
3. **education pack** (lecture planning, formative quiz skills)
4. **local gov pack** (council service navigation from public web sources)
5. **sustainability pack** (carbon literacy, open datasets)

Full briefs: [dissertation pack ideas on GitHub](https://github.com/malike2356/carina-mutant/blob/main/docs.carinaai.uk/docs/developer/_examples/dissertation-pack-ideas.md)

## Academic naming (optional)

For university-published npm packages, use a scoped convention (documented only; not enforced by Carina):

```
@uop/pack-healthcare-demo
@uop/pack-campus-faq
```

Replace `uop` with your institution slug. Production community packs typically use `@carina/pack-*` or your org scope.

## Contribute back

- [Contributing guide](/docs/user/contributing)
- [Good first issues](https://github.com/malike2356/carina-mutant/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)
- [GitHub Discussions](https://github.com/malike2356/carina-mutant/discussions)
- [RFC process](/docs/developer/rfc-process) for stable API change proposals

## GDPR and data ethics

- **Never** load real patient, client, or employee records into pack knowledge.  
- Use synthetic scenarios, public documents, or anonymised examples.  
- You control data on your machine when self-hosting; follow your institution's data policy.

## Support from VERLOX

- **Email:** hello@carinaai.uk  
- **Office hours:** monthly for registered module leads (schedule TBD)  
- **Mentorship:** best-effort PR feedback; no guaranteed SLA for coursework deadlines

Platform access is free. Paid internships and funding are **not** part of this program unless separately announced.

## Community

- [Community hub](https://carinaai.uk/community/)  
- [Skills Hub](https://hub.carinaai.uk) for publishing packs  
- Discord: invite URL TBD (watch GitHub Discussions)

## Related docs

- [First domain pack tutorial](/docs/developer/first-domain-pack)
- [Publishing a pack](/docs/developer/publishing-a-pack)
- [Manifesto](/docs/developer/manifesto)
