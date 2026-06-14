# Gap-close implementation prompts

Copy each prompt into Cursor (or equivalent) inside the relevant repository.
No em dashes, no emojis anywhere in generated code or comments.

## Implementation status

Last updated: 2026-06-14

| Prompt | Area | Status | Notes |
|--------|------|--------|-------|
| P1 | propreneur-v2: coach flooding fix + per-user opt-in | Done | `RunOptedInCoachCommand`, `coach_enabled` migration, web settings toggle; run `php artisan tenants:migrate` on deploy |
| P2 | propreneur-v2: clear-all chats confirm | Done | Alpine confirm on Carina index/show; error flash on index |
| P3 | propreneur-v2: Carina self-learning | Done | Evaluator, writer, auto-learn job; set `CARINA_AUTO_SKILL_LEARN=true` + queue worker to activate |
| P4 | propreneur-assistant: server-side Carina conversations | Done | `apiV1Json`, `carina.ts`, rewritten `useChat`, assistant list + chat screens |
| P5 | propreneur-assistant: coach opt-in in settings | Done | `coach.ts`, settings Assistant section, `PATCH /api/v1/mobile/coach/status` |
| P6 | propreneur-assistant: home dashboard monitoring cards | Done | Subscription card uses `GET /billing/subscription` (not plans catalog); `useDashboard.ts` |
| C1 | carina kernel: Line channel adapter | Done | `line-adapter.ts`, webhook at `/webhooks/line`, unit tests |
| C2 | carina kernel: Viber channel adapter | Done | `viber-adapter.ts`, webhook at `/webhooks/viber`, unit tests |
| C3 | carina kernel: Google Chat channel adapter | Done | `google-chat-adapter.ts`, verification token + service account send |
| C4 | carina kernel: Microsoft Teams channel adapter | Done | `teams-adapter.ts`, Bot Framework JWT check + outbound |
| C5 | carina kernel: Skills Hub packs | Done | `legal-uk` (6), `sales-crm` (5), `borehole-africa` (5); manifests and `.md` skill files updated |

**All prompts in this file are implemented.** Re-run targeted tests before deploy:

- propreneur-v2: `php artisan test tests/Feature/Tenant/AccountabilityCoachOptInTest.php tests/Feature/Carina/SkillAutoLearnTest.php tests/Feature/Mobile/MobileCoachOptInTest.php tests/Feature/Mobile/MobileCarinaTest.php`
- propreneur-assistant: `npx tsc --noEmit` (from `mobilesApps/propreneur-assistant/`)
- carina core: `npx vitest run` adapter and hub tests (from `carina/core.carinaai.uk/`)

---

## PROMPT P1 - Propreneur: fix accountability coach flooding (default off + per-user opt-in)

**Repository:** propreneur-v2
**Context:**
The accountability coach is scheduled three times daily via `routes/console.php`:

```php
Schedule::command('carina:scheduled-agent --task=accountability-coach-morning')->dailyAt('07:00')
Schedule::command('carina:scheduled-agent --task=accountability-coach-midday')->dailyAt('13:00')
Schedule::command('carina:scheduled-agent --task=accountability-coach-evening')->dailyAt('20:00')
```

These run for every active tenant, flooding users who never opted in. The task definitions inside `app/Services/Carina/CarinaScheduledAgentService::taskList()` already have `'enabled' => false` for all three coach tasks, BUT `CarinaScheduledAgentCommand::processTenant()` bypasses the `enabled` flag when `--task=` is passed. The logic in `processTenant()` calls `runTask()` directly without checking `enabled`.

**What to build - do all of this in one pass:**

### 1. Fix the command to respect `enabled` even for `--task=` invocations

File: `app/Console/Commands/Carina/CarinaScheduledAgentCommand.php`

In `processTenant()`, after finding `$task` by slug (when `$targetTask !== null`), add this guard before calling `runTask()`:

```php
if (! ($task['enabled'] ?? false)) {
    $this->line("    Task '{$targetTask}' is disabled - skipping.");
    return;
}
```

### 2. Add a per-user coach opt-in preference

Create tenant migration `database/migrations/tenant/2026_07_21_100001_add_coach_enabled_to_users_table.php`:

```php
<?php
declare(strict_types=1);
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::connection('tenant')->table('users', function (Blueprint $table): void {
            $table->boolean('coach_enabled')->default(false)->after('remember_token');
        });
    }
    public function down(): void
    {
        Schema::connection('tenant')->table('users', function (Blueprint $table): void {
            $table->dropColumn('coach_enabled');
        });
    }
};
```

### 3. Update the schedule to only run for tenants that have opted-in users

File: `routes/console.php`

Replace the three bare `Schedule::command(...)` calls for the coach with a single custom command call that checks opt-in. Change the schedule to call a new artisan command `carina:run-opted-in-coach` which:
- Loops tenants
- For each tenant, checks if `users` table has at least one row where `coach_enabled = true`
- Only then fires the three sessions for that tenant

Create `app/Console/Commands/Carina/RunOptedInCoachCommand.php`:

```php
<?php
declare(strict_types=1);

namespace App\Console\Commands\Carina;

use App\Models\Central\Tenant;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;

final class RunOptedInCoachCommand extends Command
{
    protected $signature = 'carina:run-opted-in-coach';
    protected $description = 'Run accountability coach only for users who opted in.';

    public function handle(): int
    {
        $tasks = [
            'accountability-coach-morning',
            'accountability-coach-midday',
            'accountability-coach-evening',
        ];

        $now = now();

        // Only run the task matching the current hour window.
        $hour = (int) $now->format('G');
        $task = match(true) {
            $hour < 10 => 'accountability-coach-morning',
            $hour < 15 => 'accountability-coach-midday',
            default    => 'accountability-coach-evening',
        };

        Tenant::query()->where('is_active', true)->each(function (Tenant $tenant) use ($task): void {
            try {
                $tenant->run(function () use ($task, $tenant): void {
                    $hasOptedIn = \App\Models\Tenant\User::query()
                        ->where('coach_enabled', true)
                        ->exists();
                    if (! $hasOptedIn) {
                        return;
                    }
                    Artisan::call('carina:scheduled-agent', [
                        '--task'   => $task,
                        '--tenant' => $tenant->getTenantKey(),
                    ]);
                });
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::error('[RunOptedInCoach] tenant '.$tenant->getTenantKey().' failed: '.$e->getMessage());
            }
        });

        return self::SUCCESS;
    }
}
```

Register the command in `app/Console/Kernel.php` (or the commands array if using Laravel 12 auto-discovery).

Update `routes/console.php` - replace the three coach Schedule calls with:

```php
// Accountability coach: runs 3x daily; only sends to tenants with opted-in users.
Schedule::command('carina:run-opted-in-coach')->hourly();
```

The command itself picks the right coach slot by current hour.

### 4. Add per-user toggle endpoint

In `routes/tenant.php`, inside the authenticated settings group, add:

```php
Route::patch('/settings/coach-opt-in', [App\Http\Controllers\Tenant\UserSettingsController::class, 'updateCoachOptIn'])
    ->name('settings.coach-opt-in');
```

In `UserSettingsController` (create or extend), add:

```php
public function updateCoachOptIn(Request $request): JsonResponse
{
    $data = $request->validate(['enabled' => 'required|boolean']);
    /** @var \App\Models\Tenant\User $user */
    $user = Auth::user();
    $user->update(['coach_enabled' => $data['enabled']]);
    return response()->json(['ok' => true, 'coach_enabled' => $user->coach_enabled]);
}
```

### 5. Add UI toggle in Carina settings blade

Find `resources/views/tenant/carina/settings.blade.php` (or the settings partial that shows Carina preferences). Add a toggle row:

```blade
<div class="flex items-center justify-between py-3 border-b border-[rgb(var(--border-subtle))]"
     x-data="{ enabled: {{ auth()->user()->coach_enabled ? 'true' : 'false' }} }"
     x-init="$watch('enabled', async (val) => {
         await fetch('{{ route('settings.coach-opt-in') }}', {
             method: 'PATCH',
             headers: { 'X-CSRF-TOKEN': '{{ csrf_token() }}', 'Content-Type': 'application/json', 'Accept': 'application/json' },
             body: JSON.stringify({ enabled: val })
         });
     })">
    <div>
        <p class="text-sm font-medium text-[rgb(var(--text-primary))]">Daily accountability coach</p>
        <p class="text-xs text-[rgb(var(--text-muted))] mt-0.5">Carina checks in three times a day to keep you on track. Off by default.</p>
    </div>
    <button type="button"
            x-on:click="enabled = !enabled"
            :class="enabled ? 'bg-indigo-600' : 'bg-[rgb(var(--surface-raised))]'"
            class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none">
        <span :class="enabled ? 'translate-x-5' : 'translate-x-0'"
              class="inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"></span>
    </button>
</div>
```

**Rules to follow:**
- `declare(strict_types=1)` on every new PHP file
- Tenant migrations extend `Migration` and use `Schema::connection('tenant')`
- Tenant migrations live in `database/migrations/tenant/`
- No raw SQL - use Eloquent/query builder
- No closures in routes - named controllers only
- No emojis or em dashes in any output

---

## PROMPT P2 - Propreneur: fix clear-all-chats

**Repository:** propreneur-v2
**Context:**
The "Clear all" button exists in two blade templates:
- `resources/views/tenant/carina/index.blade.php:69-78`
- `resources/views/tenant/carina/show.blade.php:28-37`

Both use a `<form method="POST" ... onsubmit="return confirm(...)">` with `@method('DELETE')` and `@csrf`, targeting the route `tenant.carina.destroy-mine-all` which maps to `DELETE /carina/conversations/mine/all` handled by `CarinaController::destroyAllMine()`.

The controller logic is correct: it chunks and deletes all conversations for `Auth::id()`, then redirects (non-JSON) to `tenant.carina.index` with a flash `success` message, or returns JSON for API calls.

**Known issues to fix:**

1. The `onsubmit="return confirm(...)"` native browser dialog is blocked in some browsers and tenant iframe contexts, silently preventing submission. Replace with an Alpine.js confirm pattern.

2. The flash `success` message from the redirect must be shown in the conversations index view. Check `resources/views/tenant/carina/index.blade.php` and ensure the success flash is rendered (look for `session('success')` handling in the layout or add it if missing).

3. After clear-all is triggered from `show.blade.php` (while viewing a conversation), the redirect to `tenant.carina.index` is correct. Verify the route name `tenant.carina.index` resolves (it should - it is `Route::get('/conversations', ...)->name('index')` inside `->name('tenant.carina.')` group).

**What to change:**

In both `index.blade.php` and `show.blade.php`, replace the form's `onsubmit` attribute with an Alpine.js `@submit.prevent` pattern:

```blade
<form method="POST"
      action="{{ route('tenant.carina.destroy-mine-all') }}"
      x-data="{ confirming: false }"
      @submit.prevent="if (!confirming) {
          confirming = true;
          if (window.confirm('Delete all your Carina conversations? This cannot be undone.')) {
              $el.submit();
          } else {
              confirming = false;
          }
      }">
    @csrf
    @method('DELETE')
    <button type="submit"
            class="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
        Clear all
    </button>
</form>
```

In `resources/views/tenant/carina/index.blade.php`, near the top of the `@section('content')`, add flash message display if not already present:

```blade
@if (session('success'))
    <div class="mb-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-300">
        {{ session('success') }}
    </div>
@endif
```

Also add an error flash for when throttle blocks the request (HTTP 429):

In `CarinaController::destroyAllMine()`, before the redirect, add:

```php
if ($count === 0) {
    $message = 'No conversations found to remove.';
} else {
    $message = "Removed {$count} conversation(s).";
}
```

(The current code already does this - just ensure the flash is visible in the view.)

**Rules:** No emojis, no em dashes, no raw SQL, `declare(strict_types=1)` on any new PHP.

---

## PROMPT P3 - Propreneur: enable Carina self-learning (skill auto-generation from sessions)

**Repository:** propreneur-v2
**Context:**
Propreneur has a PHP-based Carina implementation. Skills are authored as `.md` files with YAML frontmatter, compiled into a JSON manifest, and injected into the system prompt by `SkillContextInjector`. The compiler/parser is `CarinaSkillMarkdownParser.php`. The main agent entry point is `CarinaAgentService::agentChat()`.

There is currently NO mechanism for Carina to write new skill files from its own session interactions. The Carina open-source kernel (TypeScript) has this via `session-learner.ts` + `auto-writer.ts`. This prompt adds the equivalent in PHP for Propreneur.

**What to build:**

### 1. CarinaSessionEvaluatorService

Create `app/Services/Carina/CarinaSessionEvaluatorService.php`:

This service receives the completed conversation turn (user message + assistant reply + tool log) and asks the AI (via `AiRouterService`) whether a reusable skill can be extracted. If the AI says yes, it returns a structured skill definition.

```php
<?php
declare(strict_types=1);
namespace App\Services\Carina;

use App\Services\Carina\AiRouterService;
use Illuminate\Support\Facades\Log;

final class CarinaSessionEvaluatorService
{
    public function __construct(
        private readonly AiRouterService $ai,
    ) {}

    /**
     * Given a completed turn, ask the AI if a reusable skill can be extracted.
     * Returns the skill definition array, or null if not worth saving.
     *
     * @param array{user: string, assistant: string, tools?: list<string>} $turn
     * @return array{name: string, description: string, applies_when: list<string>, content: string}|null
     */
    public function evaluate(array $turn): ?array
    {
        $prompt = $this->buildPrompt($turn);
        try {
            $raw = $this->ai->complete($prompt, maxTokens: 600, model: 'fast');
        } catch (\Throwable $e) {
            Log::debug('[CarinaSessionEvaluator] AI call failed: '.$e->getMessage());
            return null;
        }

        return $this->parseSkillResponse($raw);
    }

    private function buildPrompt(array $turn): string
    {
        $user  = substr($turn['user'], 0, 800);
        $reply = substr($turn['assistant'], 0, 1200);
        $tools = implode(', ', $turn['tools'] ?? []);

        return <<<PROMPT
You are reviewing a completed AI assistant conversation turn.
Decide if the approach the assistant used is worth saving as a reusable skill.

A skill is worth saving when:
- The task is something that will recur (e.g. a deal analysis, compliance check, document summary).
- The assistant used a non-obvious but effective approach.
- The skill content would help future turns complete similar tasks faster.

If the turn is worth saving, respond with a JSON object exactly like:
{
  "worth_saving": true,
  "name": "kebab-case-skill-name",
  "description": "One sentence describing what this skill does.",
  "applies_when": ["phrase that matches user message", "another phrase"],
  "content": "The core approach, method, or knowledge the assistant applied. Plain text, under 400 words."
}

If NOT worth saving, respond: {"worth_saving": false}

User message: {$user}

Assistant reply: {$reply}

Tools used: {$tools}

Respond with JSON only.
PROMPT;
    }

    /**
     * @return array{name: string, description: string, applies_when: list<string>, content: string}|null
     */
    private function parseSkillResponse(string $raw): ?array
    {
        $json = json_decode(trim($raw), true);
        if (! is_array($json) || ! ($json['worth_saving'] ?? false)) {
            return null;
        }
        $name        = preg_replace('/[^a-z0-9\-]/', '', strtolower($json['name'] ?? ''));
        $description = trim((string) ($json['description'] ?? ''));
        $appliesWhen = array_values(array_filter(array_map('trim', (array) ($json['applies_when'] ?? []))));
        $content     = trim((string) ($json['content'] ?? ''));
        if ($name === '' || $description === '' || $appliesWhen === [] || $content === '') {
            return null;
        }
        return compact('name', 'description', 'applies_when', 'content');
    }
}
```

### 2. CarinaSkillWriterService

Create `app/Services/Carina/CarinaSkillWriterService.php`:

This service takes a skill definition and writes it as a `.md` file to the skills directory, then triggers recompilation.

```php
<?php
declare(strict_types=1);
namespace App\Services\Carina;

use Illuminate\Support\Facades\Log;

final class CarinaSkillWriterService
{
    private string $skillsDir;

    public function __construct()
    {
        $this->skillsDir = config('carina.skills_path', base_path('brain/skills'));
    }

    /**
     * @param array{name: string, description: string, applies_when: list<string>, content: string} $skill
     */
    public function write(array $skill, string $tenantSlug = 'shared'): bool
    {
        try {
            if (! is_dir($this->skillsDir)) {
                mkdir($this->skillsDir, 0755, true);
            }
            $filename = $this->skillsDir.'/'.$tenantSlug.'-'.$skill['name'].'.md';
            // Do not overwrite an existing skill - curator handles merging.
            if (file_exists($filename)) {
                Log::debug('[CarinaSkillWriter] skill already exists, skipping: '.$filename);
                return false;
            }
            $appliesLines = implode("\n", array_map(fn ($t) => "  - {$t}", $skill['applies_when']));
            $md = <<<MD
---
name: {$skill['name']}
description: {$skill['description']}
version: 1.0.0
applies_when:
{$appliesLines}
tags: [auto-generated, {$tenantSlug}]
---

{$skill['content']}
MD;
            file_put_contents($filename, $md);
            Log::info('[CarinaSkillWriter] wrote skill: '.$filename);
            return true;
        } catch (\Throwable $e) {
            Log::error('[CarinaSkillWriter] failed: '.$e->getMessage());
            return false;
        }
    }
}
```

### 3. CarinaSkillAutoLearnJob

Create `app/Jobs/Carina/CarinaSkillAutoLearnJob.php`:

```php
<?php
declare(strict_types=1);
namespace App\Jobs\Carina;

use App\Services\Carina\CarinaSessionEvaluatorService;
use App\Services\Carina\CarinaSkillWriterService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

final class CarinaSkillAutoLearnJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 1;
    public int $timeout = 60;

    /**
     * @param array{user: string, assistant: string, tools?: list<string>} $turn
     */
    public function __construct(
        private readonly array $turn,
        private readonly string $tenantSlug,
    ) {}

    public function handle(
        CarinaSessionEvaluatorService $evaluator,
        CarinaSkillWriterService $writer,
    ): void {
        $skill = $evaluator->evaluate($this->turn);
        if ($skill === null) {
            return;
        }
        $wrote = $writer->write($skill, $this->tenantSlug);
        if ($wrote) {
            Log::info('[CarinaAutoLearn] new skill auto-generated for tenant '.$this->tenantSlug.': '.$skill['name']);
            // Dispatch skill recompile to refresh the manifest
            \App\Jobs\Carina\CarinaCompileSkillsJob::dispatch($this->tenantSlug)->onQueue('default');
        }
    }
}
```

If `CarinaCompileSkillsJob` does not exist, create a stub job that calls the existing skill compiler artisan command or `SkillContextInjector`'s recompile method.

### 4. Wire into CarinaAgentService::agentChat()

File: `app/Services/Carina/CarinaAgentService.php`

At the end of `agentChat()`, after building the final reply string and before returning, add (gated by the env var `CARINA_AUTO_SKILL_LEARN`):

```php
if (config('services.carina.auto_skill_learn', false) && isset($userMessage) && isset($assistantReply)) {
    $tenantSlug = optional(tenancy()->tenant)->getTenantKey() ?? 'shared';
    $toolNames  = array_column($actionLog ?? [], 'tool');
    \App\Jobs\Carina\CarinaSkillAutoLearnJob::dispatch(
        ['user' => $userMessage, 'assistant' => $assistantReply, 'tools' => $toolNames],
        $tenantSlug,
    )->onQueue('default');
}
```

Add to `config/services.php` under `carina`:

```php
'auto_skill_learn' => env('CARINA_AUTO_SKILL_LEARN', false),
```

Add to `.env.example`:

```
CARINA_AUTO_SKILL_LEARN=false
```

To activate: set `CARINA_AUTO_SKILL_LEARN=true` in the production `.env` (done via deploy.env or server .env edit - do NOT commit the production value).

**Rules:**
- `declare(strict_types=1)` on every new PHP file
- Every new job implements `ShouldQueue`
- No AI calls from controllers - all AI calls go through `app/Services/Carina/`
- No emojis or em dashes in code, comments, or error messages

---

## API PATH SPLIT - read before touching any mobile API call

The app has two co-existing API bases, both derived automatically from the stored workspace origin by the v1 API client (`src/api/client.ts`):

| Base path | Used for |
|---|---|
| `/api/mobile/v1` | Legacy endpoints: portfolio, briefing. Do NOT migrate these. |
| `/api/v1/mobile` | All new endpoints: Carina, coach, billing monitoring, compliance alerts. |

The client resolves the host from the stored workspace origin; you only supply the path suffix. When adding or updating API calls, use the correct base for the resource type. Do not change the legacy portfolio/briefing paths.

---

## PROMPT P4 - Propreneur mobile app: migrate to server-side conversation API + fix clear-all

**Repository:** propreneur-assistant (Expo React Native, in `mobilesApps/propreneur-assistant/`)
**Context:**
The mobile app currently uses a legacy stateless chat API (`POST /api/mobile/v1/chat/send`) and stores conversation history in AsyncStorage only. The backend has a full conversation-based REST API at `/api/v1/mobile/carina/` with:
- `GET /api/v1/mobile/carina/conversations` - list conversations
- `POST /api/v1/mobile/carina/conversations` - start a new conversation
- `GET /api/v1/mobile/carina/conversations/{id}` - get conversation with messages
- `POST /api/v1/mobile/carina/conversations/{id}/messages` - send a message
- `DELETE /api/v1/mobile/carina/conversations/{id}` - delete a single conversation
- `GET /api/v1/mobile/carina/usage` - quota usage

The `src/api/chat.ts` uses the old endpoints. The `src/hooks/useChat.ts` reads conversations from AsyncStorage. The `app/(tabs)/assistant.tsx` delete function only deletes from AsyncStorage, not the server.

**API path rule for this prompt:** Carina endpoints use `/api/v1/mobile/carina/...`. The legacy `/api/mobile/v1/chat/send` path used by `chat.ts` is what is being replaced. Portfolio and briefing calls elsewhere in the app stay on `/api/mobile/v1` - do not touch them.

**What to build:**

### 1. Replace `src/api/chat.ts` with server-backed conversation API

Keep the old file's send/voice/image functions but change them to use the new endpoints. Also add the missing CRUD functions.

```typescript
// src/api/carina.ts  (new file; deprecate the old chat.ts references)
import { apiJson, apiMultipart } from './client';
import type {
  Conversation,
  ConversationDetail,
  MessageResponse,
  CarinaUsage,
} from '@/types/api';

// List all conversations (paginated, sorted latest first)
export function listConversations(): Promise<{ data: Conversation[] }> {
  return apiJson('/carina/conversations');
}

// Start a fresh conversation (returns the new conversation with id)
export function startConversation(title?: string): Promise<Conversation> {
  return apiJson('/carina/conversations', {
    method: 'POST',
    body: JSON.stringify({ title: title ?? 'New chat' }),
  });
}

// Get a conversation with its messages
export function getConversation(id: number): Promise<ConversationDetail> {
  return apiJson(`/carina/conversations/${id}`);
}

// Send a text message to a conversation
export function sendMessage(conversationId: number, message: string): Promise<MessageResponse> {
  return apiJson(`/carina/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

// Send a voice note (multipart)
export function sendVoice(conversationId: number, audioUri: string): Promise<MessageResponse> {
  const formData = new FormData();
  formData.append('audio', { uri: audioUri, type: 'audio/m4a', name: 'voice.m4a' } as unknown as Blob);
  return apiMultipart(`/carina/conversations/${conversationId}/messages/stream`, formData);
}

// Delete a single conversation (server + local)
export function deleteConversation(id: number): Promise<void> {
  return apiJson(`/carina/conversations/${id}`, { method: 'DELETE' });
}

// Get quota usage
export function getUsage(): Promise<CarinaUsage> {
  return apiJson('/carina/usage');
}
```

In `src/config/api.ts`, add or update the Carina section to use path prefix `/api/v1/mobile/carina` (the new authenticated route group). Do not change the base URL logic in the client - the client already derives the host from the stored workspace origin. Only update the path strings for Carina calls. Leave portfolio and briefing path strings untouched; they are intentionally on the legacy `/api/mobile/v1` prefix.

### 2. Rewrite `src/hooks/useChat.ts` to use server data

Replace AsyncStorage as the source of truth with server API calls. Keep AsyncStorage as an offline cache layer only (write after fetch, read as stale-while-revalidate).

- `useConversations()`: call `GET /carina/conversations`, cache results in AsyncStorage as fallback
- `useConversationMessages(id)`: call `GET /carina/conversations/{id}`, cache messages
- `useSendMessage()`: call `POST /carina/conversations/{id}/messages`, invalidate conversation list
- `useDeleteConversation()`: call `DELETE /carina/conversations/{id}`, remove from AsyncStorage cache, invalidate list
- `useClearAllConversations()`: call `DELETE /carina/conversations/{id}` for each conversation in the list (loop), or add a backend bulk-delete if it exists; then clear AsyncStorage

For useSendMessage - if no `conversationId`, first call `startConversation()` to get one, then send the message. Store the `conversationId` in component state for subsequent messages in the same session.

### 3. Update `app/(tabs)/assistant.tsx` conversation list screen

- Replace local-only delete (`handleDelete`) with a mutation that calls `deleteConversation(id)` from the new hooks
- Add a "Clear all" action (trash icon in the header) that shows a confirm Alert and calls `useClearAllConversations()`
- Show a loading skeleton while conversations are fetching from the server
- Show an empty state with a "Start your first conversation" button if the list is empty

### 4. Update `app/assistant/[id].tsx` (conversation detail/chat screen)

If the screen does not exist, create it at `app/assistant/[id].tsx`. It should:
- Accept `id` as a route param (0 = new conversation)
- Load messages via `useConversationMessages(id)` (or start fresh if id=0)
- Show the message list in a `FlatList`, user messages right-aligned, Carina replies left-aligned
- Bottom input bar with text input, voice button, send button
- On send: call `useSendMessage()`, append the new message pair optimistically
- Show a typing indicator while waiting for the reply

### 5. Update `src/config/api.ts`

Change only the Carina chat path strings to point to `/api/v1/mobile/carina` (the new authenticated endpoint group), replacing the legacy `/api/mobile/v1/chat` paths. The client resolves the workspace host automatically from stored origin - only the path suffix changes. Portfolio and briefing paths in the same config file stay on `/api/mobile/v1` as-is.

**Type additions needed in `src/types/api.ts`:**
- `Conversation`: `{ id: number; title: string; updated_at: string; total_tokens?: number }`
- `ConversationDetail`: `Conversation & { messages: Message[] }`
- `Message`: `{ id: number; role: 'user' | 'assistant'; content: string; created_at: string }`
- `MessageResponse`: `{ reply: string; conversation_id: number; actions?: unknown[]; requires_confirmation?: boolean }`
- `CarinaUsage`: `{ used: number; limit: number; period: string }`

**Rules:**
- No emojis or em dashes in any output, comments, or UI strings
- Use `@tanstack/react-query` for all data fetching (already installed)
- Preserve the existing voice and image send capability (re-wire to new endpoints)
- Do not remove the `app/(tabs)/assistant.tsx` file - update it in place

---

## PROMPT P5 - Propreneur mobile app: add accountability coach opt-in in settings

**Repository:** propreneur-assistant
**Context:**
The backend has `GET /api/v1/mobile/coach/status` and the per-user `coach_enabled` boolean column added by Prompt P1. The settings screen at `app/(tabs)/settings.tsx` currently has toggles for `telegram_notifications_enabled`, `audio_enabled`, and local preferences. There is no coach toggle.

**What to add:**

In `src/api/coach.ts` (create if missing), add:

```typescript
import { apiJson } from './client';

export function getCoachStatus(): Promise<{ enabled: boolean; persona: string; checkin_times: string[] }> {
  return apiJson('/coach/status');
}

export function setCoachEnabled(enabled: boolean): Promise<{ ok: boolean }> {
  return apiJson('/coach/status', {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
  });
}
```

Note: If the `MobileCoachController::status()` does not yet return `enabled` (the `coach_enabled` column added by P1), extend it to include `enabled: $user->coach_enabled` in the JSON response.

In `app/(tabs)/settings.tsx`, add a `coachEnabled` state variable initialized from the coach status API call, and add a new settings row in the "Assistant" section:

```tsx
<View style={styles.settingRow}>
  <View style={styles.settingLabelGroup}>
    <Text style={styles.settingLabel}>Daily accountability coach</Text>
    <Text style={styles.settingDescription}>
      Carina checks in three times a day. Off by default.
    </Text>
  </View>
  <Switch
    value={coachEnabled}
    onValueChange={async (val) => {
      setCoachEnabled(val);
      await coachApi.setCoachEnabled(val);
    }}
    trackColor={{ false: colors.border, true: colors.primary }}
    thumbColor={colors.white}
  />
</View>
```

Load the initial value in the `useEffect` that loads profile data:

```typescript
const coachStatus = await coachApi.getCoachStatus();
setCoachEnabled(coachStatus.enabled ?? false);
```

**Backend note:** The `PATCH /api/v1/mobile/coach/status` endpoint may not exist yet. If so, add it to `routes/tenant/mobile_v1_api.php`:

```php
Route::patch('/status', [MobileCoachController::class, 'setEnabled'])->name('status.update');
```

And add `setEnabled` to `MobileCoachController`:

```php
public function setEnabled(Request $request): JsonResponse
{
    $data = $request->validate(['enabled' => 'required|boolean']);
    /** @var \App\Models\Tenant\User $user */
    $user = Auth::user();
    $user->update(['coach_enabled' => $data['enabled']]);
    return response()->json(['ok' => true, 'coach_enabled' => $user->coach_enabled]);
}
```

**Rules:** No emojis, no em dashes, declare(strict_types=1) on any new PHP.

---

## PROMPT P6 - Propreneur mobile app: home dashboard monitoring cards

**Repository:** propreneur-assistant
**Context:**
The home tab (`app/(tabs)/index.tsx`) shows a basic dashboard. Users need to quickly see their account status. The backend has:
- `GET /api/v1/mobile/billing/subscription` for the workspace's current plan, status, and trial (canonical for Card 3)
- `GET /api/v1/mobile/billing/plans` for the plan catalogue only (no current tenant status; not sufficient alone for Card 3)
- `GET /api/v1/mobile/billing/portal` for Stripe billing portal URL
- `GET /api/v1/mobile/compliance/items` for compliance items
- `GET /api/v1/mobile/carina/usage` for Carina quota

All billing routes require the `stripe_billing_api` feature flag. If disabled, hide the subscription card on fetch failure.

**What to add to `app/(tabs)/index.tsx`:**

Add three monitoring cards at the top of the home screen (above existing content):

### Card 1: Carina quota

Fetch from `GET /api/v1/mobile/carina/usage`. Show:
- Circular progress or horizontal bar: `used / limit` messages
- Label: "Carina messages this month"
- If at 80%+, show a warning tint

### Card 2: Compliance alerts

Fetch from `GET /api/v1/mobile/compliance/items`. Count items where `expires_at` is within 30 days or `status === 'overdue'`. Show:
- Number of items needing attention
- "X compliance items expiring soon" or "All compliance items up to date"
- Tapping navigates to `app/compliance/index.tsx`

### Card 3: Subscription status

Fetch from `GET /api/v1/mobile/billing/subscription` (not `billing/plans`). The plans endpoint only lists available catalogue plans; it does not return the signed-in workspace's current subscription, trial end, or Stripe status.

Response shape (`data`):

```json
{
  "plan_name": "Growth",
  "plan_slug": "growth",
  "status": "active",
  "phase": "subscribed",
  "trial_ends_at": null,
  "trial_days_remaining": null
}
```

`status` is one of `active`, `trial`, or `expired`. Backend: `MobileBillingController::subscription()` in propreneur-v2.

Show on the card:
- Plan name (`plan_name`) and status (`active` / `trial` / `expired`)
- Days remaining on trial when `status === 'trial'` (use `trial_days_remaining`)
- "Manage billing" link that calls `GET /api/v1/mobile/billing/portal` on tap and opens the returned `url` in the device browser (portal returns `{ url }` without a `data` wrapper)

Optional: keep `getPlans()` in `src/api/billing.ts` for a future plan-picker screen; do not use it for this dashboard card.

**Implementation pattern:**
Use React Query's `useQuery` for each card. Show a skeleton placeholder while loading. If any fetch fails (e.g. feature not enabled on plan), hide that card gracefully (catch the error, return null).

Create `src/api/billing.ts` with `getSubscriptionStatus()`, `getPlans()`, and `getBillingPortal()`.
Create `src/api/compliance.ts` with `getComplianceItems()` (v1 path) if not already present.
Add `src/hooks/useDashboard.ts` that exports `useCarinaUsage()`, `useComplianceAlerts()`, and `useSubscriptionStatus()` (calls `getSubscriptionStatus()`, not `getPlans()`).

**Rules:** No emojis, no em dashes in any output or UI strings. Match the existing card/shadow style from `app/(tabs)/index.tsx`.

---

## PROMPT C1 - Carina kernel: add Line channel adapter

**Repository:** carina (core.carinaai.uk directory)
**Context:**
Existing channel adapters are in `src/gateway/channels/adapters/`. They implement the interface in `src/gateway/channels/channel-adapter.interface.ts`. The `ChannelName` union in that file needs a new member `'line'`. Existing adapters (telegram, whatsapp, slack) are the pattern to follow. Each adapter:
1. Has a class that implements `ChannelAdapter`
2. Registers webhook routes on an Express `Router`
3. Parses incoming webhook payload into `ChannelMessage`
4. Has a `send(message: OutboundMessage, options?: SendOptions)` method that calls the platform API
5. Has a test file `*.test.ts`

**Line API basics:**
- Webhook: POST from Line server with `X-Line-Signature` HMAC-SHA256 header
- Send message: `POST https://api.line.me/v2/bot/message/reply` with `Authorization: Bearer {CHANNEL_ACCESS_TOKEN}`
- Events array in webhook body; handle `message` events with `type: 'text'`
- Reply token is in `event.replyToken`
- User ID: `event.source.userId`

**Env vars to document in `.env.example`:**
```
LINE_CHANNEL_SECRET=
LINE_CHANNEL_ACCESS_TOKEN=
```

**What to build:**
1. `src/gateway/channels/adapters/line-adapter.ts` - full adapter
2. `src/gateway/channels/adapters/line-adapter.test.ts` - unit tests for signature verification and message parsing
3. Add `'line'` to the `ChannelName` union in `channel-adapter.interface.ts`
4. Register the adapter in `src/gateway/channels/channel-registry.ts` (or wherever adapters are registered) gated by `LINE_CHANNEL_SECRET && LINE_CHANNEL_ACCESS_TOKEN`

**Rules:** No emojis, no em dashes. Match the exact TypeScript patterns in the existing adapters. Add JSDoc only where the WHY is non-obvious.

---

## PROMPT C2 - Carina kernel: add Viber channel adapter

**Repository:** carina (core.carinaai.uk directory)
**Context:** Same as C1. Follow the existing adapter pattern.

**Viber API basics:**
- Webhook: POST with `X-Viber-Content-Signature` HMAC-SHA256 header
- Set webhook: `POST https://chatapi.viber.com/pa/set_webhook` with `auth_token` header
- Send message: `POST https://chatapi.viber.com/pa/send_message`
- Event type for incoming text: `type: 'message'` with `message.type: 'text'`
- Sender ID: `event.sender.id`

**Env vars:**
```
VIBER_AUTH_TOKEN=
```

**What to build:**
1. `src/gateway/channels/adapters/viber-adapter.ts`
2. `src/gateway/channels/adapters/viber-adapter.test.ts`
3. Add `'viber'` to `ChannelName` union
4. Register in channel registry gated by `VIBER_AUTH_TOKEN`

**Rules:** No emojis, no em dashes. Match existing adapter patterns.

---

## PROMPT C3 - Carina kernel: add Google Chat channel adapter

**Repository:** carina (core.carinaai.uk directory)
**Context:** Same adapter pattern. Google Chat uses a different auth model (JWT bearer token from a service account, or a simple verification token for HTTP endpoints).

**Google Chat basics:**
- Incoming: POST from Google servers to registered endpoint
- Verify request: check `Authorization: Bearer <token>` where token is a Google-signed JWT; verify with Google's public keys, or use a simpler shared secret `GOOGLE_CHAT_VERIFICATION_TOKEN`
- Outbound: REST `POST https://chat.googleapis.com/v1/spaces/{spaceId}/messages` with service account credentials (or reply inline by returning JSON from the webhook handler)
- Event type for text: `event.type === 'MESSAGE'`, text in `event.message.text`
- Space/room ID: `event.space.name`
- Sender: `event.message.sender.displayName` + `event.message.sender.name`

**Env vars:**
```
GOOGLE_CHAT_VERIFICATION_TOKEN=
GOOGLE_CHAT_SERVICE_ACCOUNT_JSON=
```

Implement the simpler verification-token approach for the webhook (check header or body token). For sending, use the REST API with the service account JSON.

**What to build:**
1. `src/gateway/channels/adapters/google-chat-adapter.ts`
2. `src/gateway/channels/adapters/google-chat-adapter.test.ts`
3. Add `'google-chat'` to `ChannelName` union
4. Register in channel registry gated by `GOOGLE_CHAT_VERIFICATION_TOKEN`

**Rules:** No emojis, no em dashes. Match existing adapter patterns.

---

## PROMPT C4 - Carina kernel: add Microsoft Teams channel adapter

**Repository:** carina (core.carinaai.uk directory)
**Context:** Same adapter pattern. Teams uses the Bot Framework protocol.

**Teams/Bot Framework basics:**
- Register an Azure Bot; configure the Carina endpoint as the messaging endpoint
- Incoming: POST with `Authorization: Bearer <JWT>` issued by Bot Framework; verify with `https://login.botframework.com/v1/.well-known/openidconfiguration`
- Activity body: `activity.type === 'message'`, text in `activity.text`
- Conversation ID: `activity.conversation.id`
- Sender: `activity.from.name` + `activity.from.id`
- Outbound: `POST https://smba.trafficmanager.net/apis/...` (service URL from activity), using OAuth client credentials for Bot Framework

For initial implementation, use HMAC signing via `TEAMS_APP_ID` and `TEAMS_APP_PASSWORD` (Bot Framework credentials). The `botbuilder` npm package can handle this but to keep dependencies minimal, implement the JWT verification manually using the public keys endpoint.

**Env vars:**
```
TEAMS_APP_ID=
TEAMS_APP_PASSWORD=
TEAMS_TENANT_ID=
```

**What to build:**
1. `src/gateway/channels/adapters/teams-adapter.ts`
2. `src/gateway/channels/adapters/teams-adapter.test.ts`
3. Add `'teams'` to `ChannelName` union
4. Register in channel registry gated by `TEAMS_APP_ID && TEAMS_APP_PASSWORD`

**Rules:** No emojis, no em dashes. Match existing adapter patterns. Minimize new dependencies.

---

## PROMPT C5 - Carina kernel: seed Skills Hub with legal-uk, sales-crm, and borehole-africa packs

**Repository:** carina (core.carinaai.uk directory)
**Context:**
The Skills Hub already has `property-uk` and `core-engineering` packs seeded. The `src/skills/pack-manifests.ts` file has manifest stubs for `legal-uk`, `sales-crm`, and `borehole-africa` but they have no skill files yet. The `src/skills/hub/seed.ts` calls `listKnownPackNames()` and seeds whatever packs are registered.

Skill files are `.md` files with YAML frontmatter. The structure is:
```
---
name: kebab-case-name
description: One sentence.
version: 1.0.0
applies_when:
  - phrase that triggers this skill
  - another trigger phrase
tags: [tag1, tag2]
---

The skill content (plain markdown, the guidance Carina follows for this task).
```

**What to build:**

### Pack: legal-uk

Create `src/skills/packs/legal-uk/` directory with at minimum 6 skill files:

1. `contract-review-basics.md` - how to review a UK property contract (key clauses: completion date, deposit, title, fixtures)
2. `section-21-notice.md` - Section 21 no-fault eviction: validity conditions, notice period, prescribed information requirements
3. `lease-extension.md` - leasehold extension rights under Leasehold Reform Act; two-year ownership requirement, statutory vs informal route
4. `right-to-rent.md` - UK Right to Rent checks: documents, share codes, record-keeping obligations
5. `stamp-duty-land-tax.md` - SDLT thresholds, first-time buyer relief, higher rates for additional dwellings
6. `deposit-protection.md` - UK tenancy deposit protection: 30-day deadline, three approved schemes, prescribed information

Update `PACK_MANIFESTS['legal-uk']` in `src/skills/pack-manifests.ts` with `skillCount: 6` and add `author`, `version`, `description`, `optional: true`.

### Pack: sales-crm

Create `src/skills/packs/sales-crm/` with at minimum 5 skill files:

1. `deal-qualification.md` - BANT and MEDDIC qualification frameworks; when to walk away
2. `follow-up-cadence.md` - optimal follow-up timing and channel sequencing for UK property investors
3. `objection-handling.md` - common objections in property investment sales and how to handle them
4. `pipeline-review.md` - weekly pipeline review checklist; stage definitions and exit criteria
5. `investor-profiling.md` - how to profile a property investor: capital capacity, strategy preference, timeline, risk appetite

Update `PACK_MANIFESTS['sales-crm']` with `skillCount: 5`.

### Pack: borehole-africa

Create `src/skills/packs/borehole-africa/` with at minimum 5 skill files:

1. `borehole-siting.md` - hydrogeological siting criteria for borehole drilling in sub-Saharan Africa: rock type, fracture zones, proximity to contamination sources
2. `drilling-cost-estimation.md` - cost factors: depth, casing material (PVC vs steel), mobilisation, region
3. `water-quality-testing.md` - minimum test parameters for potable water: pH, turbidity, E.coli, nitrates, WHO thresholds
4. `community-handover.md` - community WASH handover checklist: caretaker training, maintenance fund, usage rules
5. `pump-selection.md` - pump types for African boreholes: hand pump (Afridev, India Mark II), solar submersible; selection criteria by depth and population

Update `PACK_MANIFESTS['borehole-africa']` with `skillCount: 5`, `category: 'africa'`.

### After creating all pack files

Run `pnpm hub` to verify the Hub server starts and lists all three new packs. Run `pnpm test -- --testPathPattern=hub` to confirm Hub tests pass.

**Rules:** No emojis, no em dashes in any skill file content, manifest, or code. All skill content must be accurate, professionally written plain text. Do not hallucinate API URLs or legal thresholds - use conservative, verifiable information.
