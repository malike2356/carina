# Nexio Phase 5 - Lightweight Mode Launches

Phase 5 exposes three existing platform modes via persona config (no new feature builds).

| Mode | Slug | Marketing | Carina knowledge |
|---|---|---|---|
| Propreneur Let | `btl` | `propreneur.co.uk/let.html` | `171-propreneur-let-btl-guide.md` |
| Propreneur Pulse | `sourcer` | `propreneur.co.uk/pulse.html` | `172-propreneur-pulse-sourcing-guide.md` |
| Propreneur Academy | `mentor` | `propreneur.co.uk/academy.html` | `173-propreneur-academy-mentor-guide.md` |

## Signup persona

`App\Services\Persona\SignupPersonaService` stores `signup_persona` in session/cookie from:

- Query `?persona=btl|hmo|sourcer|mentor`
- Referrer from `/let.html`, `/pulse.html`, `/academy.html`, `/nexio.html`

`RegisterController` and `TenantCreationService` set `tenants.persona` and fire `workspace.persona_set` with `source: signup`.

## Tests

`tests/Feature/PersonaConfig/LightweightModeTest.php`
