# Carina Kernel Phase 3: University partnership kit

## Goal

Create an outreach kit for University of Portsmouth (and similar institutions) to use Carina as a platform for student projects, dissertations, and AI coursework.

## Context

- Strategy: `CARINA_AS_LINUX.md` Phase 3 item 9
- Manifesto: prompt `01`
- Tutorial: prompt `16`
- Honest path in strategy: get 3-5 external contributors via university partnerships

## Dependencies

`01-manifesto.md`, `16-first-domain-pack-tutorial.md`

## Files to create

- `instructions/outreach/university-partnership-kit.md` (internal outreach doc)
- `docs.carinaai.uk/docs/developer/university-program.md` (public-facing program page)
- `docs.carinaai.uk/docs/developer/_examples/dissertation-pack-ideas.md` (project idea list)

## Files to modify

- `carinaai.uk/community/index.html` (link to university program)
- `MANIFESTO.md` (one sentence on education use)

## Step-by-step

1. Write internal kit `instructions/outreach/university-partnership-kit.md`:

   - **Elevator pitch** for lecturers (agent OS kernel, MIT, UK-built)
   - **Offer**: free Carina core; student projects build domain packs; VERLOX offers office hours monthly (TBD schedule)
   - **Suggested modules**:
     - UG: build a hello domain pack (tutorial `16`)
     - MSc: vertical pack with RAG corpus + evaluation harness
     - Research: agent platform comparison paper (Carina vs LangChain vs MCP-only)
   - **Contact**: hello@carinaai.uk
   - **What VERLOX needs from university**: module lead name, approximate student count, academic calendar

2. Public page `docs/developer/university-program.md`:
   - Program overview (no confidential terms)
   - Link to tutorial, CONTRIBUTING, good first issues
   - List 5 dissertation topic ideas (healthcare-uk pack, legal-uk pack, education pack, local gov pack, sustainability pack)

3. Update `carinaai.uk/community/index.html`:
   - Section "For educators and students"
   - CTA to university program doc

4. Optional: `carina pack` academic slug prefix suggestion in dissertation ideas (`@uop/pack-*` naming convention documented, not enforced)

5. Do not promise paid internships or funding unless VERLOX confirms; keep language at "platform access and mentorship TBD"

## Expected behavior

- Lecturer can forward one public URL to students
- Internal kit gives VERLOX a consistent outreach script

## Test

- Docs build succeeds
- Public page contains no em-dashes
- Links to tutorial and CONTRIBUTING resolve

## Pitfalls

- GDPR: remind students not to put real patient/client data in packs
- University branding: do not imply official UoP endorsement without agreement
