# Nexio - Carina HMO Training (Phase 4)

## Tools (tenant agent)

| Tool | Purpose |
|---|---|
| `get_room_occupancy` | Rooms, status, tenant, rent |
| `get_compliance_score` | Latest Nexio compliance score + breakdown |
| `get_void_rooms` | Void/available rooms portfolio-wide or per property |
| `check_licence_expiry` | HMO licence expiry |
| `calculate_room_yield` | Gross yield from rent PCM vs purchase price |
| `draft_section_8` | Section 8 draft via LegalNoticeService (confirmation) |
| `get_fire_log_status` | Latest weekly fire alarm test |
| `get_awaabs_at_risk` | Awaab's Law breached/at-risk maintenance |

## Context injection

`HmoCarinaContextService` appends a workspace snapshot when central `tenants.persona = hmo` (property count, occupancy, compliance scores, fire overdue, Awaab's Law counts).

## RAG bias

When persona is `hmo`, `RagSearchService::hybridSearch` boosts chunks whose document path matches `personas.hmo.knowledge_tags` (`hmo`, `rra_2025`, `fire_safety`, `awaabs_law`).

## Knowledge files (RAG)

- `165-hmo-licensing-uk.md`
- `166-hmo-fire-safety-carina.md`
- `167-rra-2025-hmo-guide.md`
- `168-council-tax-hmo.md`
- `169-deposit-protection-hmo.md`

## HMO intro

`config/carina_hmo.php` - opener message + quick chips on empty Carina threads for HMO persona workspaces. Seeded by `CarinaHmoIntroService`.

## Tests

`tests/Feature/Carina/HmoCarinaToolsTest.php`
