
**Status: COMPLETED 2026-07-26**

**What was built:**
- `workspaces.feature_overrides` JSONB column
- `workspace-features` catalogue + service + settings API/UI
- Nav/API gates via `useWorkspaceFeatures` / `requireWorkspaceFeature`

Use this as the implementation prompt.

  # Prompt: Implement per-workspace feature toggles for Aiva Workspace

  You are working in `/opt/lampp/htdocs/verlox`. Follow all `AGENTS.md` instructions. Never use em dashes, en dashes, or emojis. Run `python3 scripts/fix-writing-style.py` before final handoff.

  ## Goal

  Add per-workspace feature toggles to Aiva Workspace so workspace admins can enable or disable specific features for their team without affecting other workspaces. The platform defaults remain the baseline. Workspace overrides take priority.

  This allows a workspace to run in "simple mode"; documents, folders, team access only; while other workspaces keep the full AI-powered experience. The same codebase serves both. Nothing is hardcoded per client.

  ## Product decision

  Feature visibility is controlled at two levels:

  - **Platform default:** Set by the platform operator for all workspaces. Lives in the existing platform feature flag system (`PlatformFeatureCatalogue`, `FeatureFlag` model).
  - **Workspace override:** Set by the workspace admin for their team only. Stored per workspace. Overrides the platform default when explicitly set.

  Resolution order at runtime:

  1. Check workspace override. If set (true or false), use it.
  2. Fall back to platform default.
  3. If neither is set, feature is off.

  The workspace admin sees a simple settings page listing available features with on/off toggles. They never see platform-level configuration or feature flag internals.

  ## Required implementation

  ### 1. Add workspace feature override storage

  Add a column to the workspaces table.

  ```sql
  ALTER TABLE workspaces ADD COLUMN feature_overrides JSONB DEFAULT '{}' NOT NULL;
  ```

  The column stores a flat key-value map:

  ```json
  {
    "ai_chat_assistant": false,
    "ai_document_search": false,
    "ai_agent_tools": false,
    "ai_reports": false
  }
  ```

  Rules:
  - Only features explicitly overridden appear in this map.
  - A missing key means "defer to platform default."
  - A present key with `true` or `false` means "override the platform default."
  - `{}` (empty) means "all features follow platform defaults."
  - Do not store user names, business names, or any client-specific data in this column. It is purely a feature configuration map.

  ### 2. Define the toggleable feature catalogue

  Create a workspace-facing feature list. This is a subset of the platform feature catalogue; only features that make sense to toggle per workspace.

  Suggested file: `app/Enums/WorkspaceFeature.php`

  ```php
  enum WorkspaceFeature: string {
      case AiChatAssistant    = 'ai_chat_assistant';
      case AiDocumentSearch   = 'ai_document_search';
      case AiAgentTools       = 'ai_agent_tools';
      case AiReports          = 'ai_reports';
      case AiAutoTagging      = 'ai_auto_tagging';
      case ActivityAnalytics  = 'activity_analytics';
      case TeamManagement     = 'team_management';
      case GoogleDriveSync    = 'google_drive_sync';
      case DocumentVault      = 'document_vault';

      public function label(): string { /* ... */ }
      public function description(): string { /* ... */ }
      public function category(): string { /* ... */ }
      public function requiresPlatformFlag(): ?string { /* ... */ }
  }
  ```

  Each feature needs:
  - `label()`; user-facing name (e.g. "Document search")
  - `description()`; one-line explanation in plain English (e.g. "Find any document by typing what you are looking for")
  - `category()`; grouping for the settings page ("AI Features", "Core Features", "Analytics")
  - `requiresPlatformFlag()`; optional platform feature flag that must also be enabled at platform level for this workspace toggle to take effect

  Categories:

  | Category | Features |
  |---|---|
  | Core Features | Document Vault, Google Drive Sync, Team Management |
  | AI Features | AI Chat Assistant, AI Document Search, AI Agent Tools, AI Auto-Tagging |
  | Analytics | AI Reports, Activity Analytics |

  Only features listed in this enum appear on the workspace settings page. Platform-level features that should never be workspace-togglable (billing, security, authentication) are excluded.

  ### 3. Build the workspace feature resolution service

  Suggested file: `app/Services/WorkspaceFeatureService.php`

  ```php
  class WorkspaceFeatureService
  {
      public function isEnabled(Workspace $workspace, WorkspaceFeature $feature): bool
      {
          // 1. Check workspace override
          if (array_key_exists($feature->value, $workspace->feature_overrides)) {
              return (bool) $workspace->feature_overrides[$feature->value];
          }

          // 2. Check platform flag if the feature requires one
          $platformFlag = $feature->requiresPlatformFlag();
          if ($platformFlag !== null) {
              return PlatformFeatureCatalogue::isEnabled($platformFlag);
          }

          // 3. Default
          return true; // Core features default on
      }

      public function setOverride(Workspace $workspace, WorkspaceFeature $feature, ?bool $value): void
      {
          $overrides = $workspace->feature_overrides;

          if ($value === null) {
              unset($overrides[$feature->value]); // Remove override, fall back to platform
          } else {
              $overrides[$feature->value] = $value;
          }

          $workspace->feature_overrides = $overrides;
          $workspace->save();
      }

      public function getAllFeatures(Workspace $workspace): array
      {
          // Returns all features with their resolved enabled/disabled state
      }

      public function getOverrides(Workspace $workspace): array
      {
          // Returns only features the workspace has explicitly overridden
      }
  }
  ```

  This service is the single source of truth for feature checks. Every UI component, route guard, and API endpoint checks through this service. Never read `feature_overrides` directly from the workspace model in UI code.

  ### 4. Add workspace admin settings page

  Add a settings page at the existing workspace settings hub.

  Route: `GET /workspace/settings/features`

  The page shows all toggleable features grouped by category. Each feature row shows:
  - Feature name (label)
  - Description
  - Toggle switch (on/off)
  - Current state indicator ("Using platform default" or "Overridden by workspace admin")

  Wireframe:

  ```
  Settings > Features
  ─────────────────────────────────────────────

  Core Features
  These features are always available.

   Document Vault                          Always available
    Store and organise all your files.       [No toggle; core features always on]

   Google Drive Sync                       Always available
    Connect your Google Drive to the         [No toggle]
    workspace.

  ─────────────────────────────────────────────

  AI Features
  AI-powered tools that help your team work faster.

   AI Chat Assistant                       [Toggle: OFF]
    Ask questions and get answers from       Using workspace override
    your documents.

   AI Document Search                      [Toggle: OFF]
    Find any document by describing          Using workspace override
    what you need.

  ─────────────────────────────────────────────

  Analytics
  Insights about your workspace activity.

   Activity Analytics                      [Toggle: ON]
    See who uploaded what and when.          Using platform default
  ```

  Behaviour:
  - Core features have no toggle. They show as "Always available" with no switch.
  - Toggleable features show the current resolved state and a switch.
  - Changing a toggle immediately creates or removes a workspace override.
  - A "Reset to platform defaults" button clears all workspace overrides.
  - Changes are saved instantly; no separate save button per toggle.
  - Each toggle change writes to the audit log.

  ### 5. Enforce feature visibility in the UI

  Update every UI component that renders a toggled feature to check the feature service before rendering.

  Pattern:

  ```php
  // Before (always renders):
  <x-carina-chat-widget />

  // After (checks workspace feature):
  @if(workspaceFeatureEnabled('ai_chat_assistant'))
      <x-carina-chat-widget />
  @endif
  ```

  ```php
  // Sidebar navigation:
  @if(workspaceFeatureEnabled('ai_document_search'))
      <x-sidebar-link href="/search" label="Search" />
  @endif
  ```

  ```php
  // Route guard:
  Route::get('/ai/search', [SearchController::class, 'index'])
      ->middleware('workspace.feature:ai_document_search');
  ```

  Components that must be gated:
  - Carina chat widget (floating and inline)
  - AI document search page and sidebar link
  - "Ask Aiva" buttons on document cards
  - AI-generated reports section
  - AI auto-tagging controls
  - Carina agent scratchpad panel
  - Any tool or action that calls the AI pipeline

  Components that must NOT be gated (always available):
  - Document vault
  - File upload
  - Google Drive sync
  - Team management
  - Workspace settings
  - Billing and subscription
  - User profile

  ### 6. Add middleware for route-level enforcement

  Suggested file: `app/Http/Middleware/RequireWorkspaceFeature.php`

  ```php
  class RequireWorkspaceFeature
  {
      public function handle($request, Closure $next, string $feature): mixed
      {
          $workspace = $request->workspace();
          $featureEnum = WorkspaceFeature::from($feature);

          if (!app(WorkspaceFeatureService::class)->isEnabled($workspace, $featureEnum)) {
              abort(404); // Not 403; feature simply does not exist for this workspace
          }

          return $next($request);
      }
  }
  ```

  Register as `workspace.feature` in the kernel. Apply to all AI-feature routes.

  Use 404 (not 403) for disabled features. The feature does not exist in this workspace. A 403 implies the user could access it if they had permission, which is not the case here.

  ### 7. Add audit logging

  Log every feature toggle change to the existing audit log system.

  Log entries:
  - `workspace_feature_override_set`; workspace admin enabled or disabled a feature
  - `workspace_feature_override_removed`; workspace admin cleared an override (fell back to platform default)
  - `workspace_feature_overrides_reset`; workspace admin reset all overrides

  Each entry includes:
  - `workspace_id`
  - `user_id` (the admin who made the change)
  - `feature` (the feature key)
  - `old_value` (previous override or "platform_default")
  - `new_value` (new override or "platform_default")
  - `timestamp`

  ### 8. Add API endpoint for the toggle UI

  Add endpoint for the frontend settings page to read and write overrides.

  ```
  GET  /api/workspace/settings/features
  POST /api/workspace/settings/features/{feature}
  DELETE /api/workspace/settings/features/{feature}
  POST /api/workspace/settings/features/reset
  ```

  `GET` response:

  ```json
  {
    "features": [
      {
        "key": "ai_chat_assistant",
        "label": "AI Chat Assistant",
        "description": "Ask questions and get answers from your documents.",
        "category": "AI Features",
        "enabled": false,
        "overridden": true,
        "source": "workspace_override"
      },
      {
        "key": "document_vault",
        "label": "Document Vault",
        "description": "Store and organise all your files.",
        "category": "Core Features",
        "enabled": true,
        "overridden": false,
        "source": "platform_default"
      }
    ]
  }
  ```

  `POST` body: `{ "enabled": true }` or `{ "enabled": false }`

  `DELETE` removes the override (falls back to platform default).

  `POST /reset` clears all overrides for the workspace.

  ### 9. Add platform admin visibility

  On the platform admin Filament panel, the workspace detail page shows current feature overrides for each workspace. Read-only. Platform operators can see which workspaces have customised their features but cannot toggle them; that belongs to the workspace admin.

  Add a `FeatureOverrides` relation or computed attribute to the workspace Filament resource.

  ### 10. Add tests

  Test coverage required:

  - Feature is enabled when workspace override is true
  - Feature is disabled when workspace override is false
  - Feature defers to platform default when no override exists
  - Feature defers to platform default when override is removed
  - Resetting all overrides clears the map to `{}`
  - Setting override to null removes the key from the map
  - Core features always show as enabled with no toggle
  - AI features respect both platform flag and workspace override
  - Middleware returns 404 for disabled features
  - Middleware passes through for enabled features
  - API GET returns correct enabled/overridden/source fields
  - API POST creates override and returns updated state
  - API DELETE removes override and falls back to platform default
  - API POST /reset clears all overrides
  - Audit log records are created on set, remove, and reset
  - Audit log records include correct old_value and new_value
  - UI does not render AI components when features are disabled
  - UI does render core components regardless of feature state

  Run:
  ```
  pnpm exec vitest run
  pnpm exec tsc --noEmit
  python3 scripts/fix-writing-style.py
  ```

  ## Acceptance criteria

  This is done only when:

  - Workspace admin can open Settings > Features and see all toggleable features grouped by category
  - Core features show as "Always available" with no toggle
  - AI and analytics features show on/off toggles
  - Toggling a feature off hides it from the workspace UI immediately
  - Toggling a feature off returns 404 for its routes
  - Toggling a feature on restores it
  - Removing an override falls back to the platform default
  - "Reset to platform defaults" clears all workspace overrides
  - Platform admin can view but not edit workspace feature overrides
  - No feature toggles are hardcoded to specific workspaces, users, or businesses
  - Audit log captures every toggle change with correct metadata
  - Document vault, file upload, Google Drive sync, team management, and billing remain always available regardless of feature state
  - Full test suite passes
  - TypeScript passes
  - Writing style scan passes
  - No client names or business names appear in code, config, or database schema
