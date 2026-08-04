# Filament admin panel (Carina + RAG)

**Updated:** 2026-04-30

## Purpose

A **Filament v3** panel lets platform-authenticated staff manage **tenant-scoped** Carina and RAG data from the central domain. It complements Blade-based `/admin/*` routes; URL prefix is separate.

## URL and auth

| Setting | Value |
|--------|--------|
| Path | `/filament` |
| Panel id | `admin` (default panel) |
| Guard | `platform` (`PlatformUser`) |
| Provider | `App\Providers\Filament\AdminPanelProvider` |

Filament ships its own login when unauthenticated; central users may also use `/platform/login` first.

## Workspace tenancy

Tenant tables (`rag_documents`, Carina conversations, etc.) use the **`tenant`** DB connection. Filament runs on the central host, so tenancy must be initialized per request when a workspace is selected.

- **Session key:** `filament.workspace_id` (central `tenants.id`).
- **Middleware:** `App\Http\Middleware\FilamentWorkspaceTenancy` is registered on the Filament panel. When the session key is set and the request path matches `filament*` or `livewire/*`, it calls `tenancy()->initialize($tenant)` for that workspace and ends tenancy after the response.
- **UI:** Resources that need a workspace picker use **`App\Filament\Concerns\InteractsWithFilamentWorkspace`** (header action to choose workspace).

If no workspace is selected, tenant-connection models resolve against an uninitialized tenant context (avoid relying on that for writes).

## Registered resources

| Resource | Model namespace | Notes |
|----------|-----------------|--------|
| `RagDocumentResource` | `App\Models\Rag\RagDocument` | RAG corpus rows (`rag_documents`). |
| `CarinaConversationResource` | `App\Models\Carina\CarinaConversation` | Tenant chat threads. |
| `CarinaSystemPromptResource` | `App\Models\Carina\CarinaSystemPrompt` | Editable system prompts. |

Widgets under `app/Filament/Widgets/` support dashboards (for example token usage tables).

## Related

- `brain/knowledge/08-carina.md` - tenant Carina UX and services.
- `brain/knowledge/23-ai-runtime-and-provider-registry.md` - provider resolution.
- Tenant JSON RAG upload/API (if routed): see `routes/api.php` and `App\Http\Controllers\Api\Rag\*`.
