# C03: Engine Switch Mechanism

**Status: COMPLETED 2026-08-07**

**What was built:**
- `AgentEngineInterface` + `KeprixAgentEngine` + `CarinaNativeAgentEngine`
- `AgentEngineFactory` with priority: channel > workspace > platform > global (env + PlatformSetting + legacy `CARINA_KEPRIX_ENABLED`)
- `AgentEngineSettings` for durable overrides (PlatformSetting / TenantSetting)
- Wired `CarinaService`, `CarinaAgentService`, `PlatformCarinaAgentService` through the factory
- Artisan: `agent-engine:status`, `switch`, `switch-all`, `switch-platform`, `switch-workspace`, `switch-channel`
- `GET /api/admin/agent-engine/status`
- Config/env: `CARINA_AGENT_ENGINE`, `CARINA_AIVA_ENGINE`, `CARINA_ADMIN_ENGINE`
- Tests: `tests/Unit/Carina/AgentEngineFactoryTest.php` (10 passed with KeprixBridge suite)

**Phase:** 1 (Foundation)
**Priority:** P0
**Depends on:** C01, C02 (proxy + tools ready)
**Target time:** 4 hours
**Location:** Carina (PHP/Laravel)

## What This Builds

A config-driven switch that routes Aiva agent calls to either the original Carina engine or the new Keprix engine. With instant rollback. No code deploy needed to switch.

## Why This Matters

- Deploy Keprix sidecar. Test with one workspace. If something breaks, flip back to Carina engine in 30 seconds.
- Gradually migrate workspaces from Carina engine to Keprix engine.
- Run both engines simultaneously for A/B testing.

## Configuration

```bash
# .env
CARINA_AGENT_ENGINE=keprix     # 'carina' or 'keprix'
CARINA_KEPRIX_URL=http://localhost:8333
CARINA_KEPRIX_SHARED_TOKEN=***
```

## Per-Workspace Override

```php
// In workspace settings table
agent_engine: 'keprix' | 'carina' | 'default'

// 'default' means use the global CARINA_AGENT_ENGINE setting
```

## Implementation

### File: `app/Services/Carina/AgentEngineFactory.php`

```php
class AgentEngineFactory
{
    public function resolve(string $workspaceId = null): AgentEngineInterface
    {
        $workspaceEngine = $this->getWorkspaceSetting($workspaceId, 'agent_engine', 'default');
        $globalEngine = env('CARINA_AGENT_ENGINE', 'carina');
        
        $engine = ($workspaceEngine !== 'default') ? $workspaceEngine : $globalEngine;
        
        return match ($engine) {
            'keprix' => app(KeprixAgentEngine::class),
            'carina' => app(CarinaNativeAgentEngine::class),
            default => throw new \Exception("Unknown agent engine: {$engine}"),
        };
    }
}
```

### Interface: `app/Services/Carina/Contracts/AgentEngineInterface.php`

```php
interface AgentEngineInterface
{
    public function runAgentTurn(
        string $workspaceId,
        string $sessionId,
        string $model,
        float $temperature,
        string $systemPrompt,
        array $messages,
        array $tools
    ): AgentResponse;
    
    public function healthCheck(): bool;
    public function name(): string;
}
```

### CarinaNativeAgentEngine (original, kept as fallback)

Wraps the existing `CarinaService.php` agent loop behind the interface. No changes to the original code. Just an adapter.

### KeprixAgentEngine (new)

Wraps `KeprixBridgeService.php` behind the interface.

## Health Check Endpoint

```
GET /api/admin/agent-engine/status

Response:
{
  "global_engine": "keprix",
  "keprix_healthy": true,
  "carina_native_healthy": true,
  "workspaces": {
    "ws_default": "keprix",
    "ws_salim": "keprix",
    "ws_test": "carina"
  }
}
```

## Admin Commands

```bash
# Switch all workspaces to Keprix
php artisan agent-engine:switch keprix

# Switch all workspaces back to Carina (emergency rollback)
php artisan agent-engine:switch carina

# Switch one workspace
php artisan agent-engine:switch keprix --workspace=ws_salim

# Show current status
php artisan agent-engine:status
```

## Rollback Procedure

```bash
# Emergency: Keprix is down, revert to Carina engine
php artisan agent-engine:switch carina

# Or: set env var and restart
# .env: CARINA_AGENT_ENGINE=carina
# php artisan octane:reload
```

Rollback time: <30 seconds. No code deploy needed.

## Granular Toggle Levels

The switch supports four levels of granularity:

| Level | Example | Config Key |
|---|---|---|
| Global | All workspaces | `CARINA_AGENT_ENGINE` |
| Platform | Aiva workers vs Carina admin chat | `CARINA_AIVA_ENGINE` / `CARINA_ADMIN_ENGINE` |
| Workspace | Salim on Keprix, Papa Lord on Carina | `workspace.agent_engine` |
| Channel | Telegram on Keprix, WhatsApp on native | `workspace.channels.{channel}.agent_engine` |

### Platform-Level Split

Aiva workers and Carina admin/support chat can run on different engines independently:

```bash
# .env
CARINA_AIVA_ENGINE=keprix       # Aiva workers use Keprix
CARINA_ADMIN_ENGINE=carina      # Platform support agent stays on Carina

# Or: both on Keprix
CARINA_AIVA_ENGINE=keprix
CARINA_ADMIN_ENGINE=keprix
```

This means an outreach automation bug on Keprix does not break the platform support agent that helps users with billing questions.

### Channel-Level Split

Per workspace, per channel:

```php
// In workspace.channels settings JSON
{
  "telegram": { "agent_engine": "keprix" },
  "whatsapp": { "agent_engine": "carina" },
  "email": { "agent_engine": "keprix" },
  "web": { "agent_engine": "carina" }
}
```

If WhatsApp integration has a bug on Keprix, flip just WhatsApp back to native. Telegram and email keep running on Keprix. The user does not lose all Aiva access.

### Resolution Priority

```
1. Channel override (most specific)
2. Workspace override
3. Platform override (Aiva vs Admin)
4. Global default (least specific)
```

### Factory Implementation

```php
class AgentEngineFactory
{
    public function resolve(
        string $workspaceId = null,
        string $platform = 'aiva',
        string $channel = 'web'
    ): AgentEngineInterface {
        // 1. Channel override
        if ($workspaceId) {
            $channelEngine = $this->getChannelSetting($workspaceId, $channel, 'agent_engine');
            if ($channelEngine && $channelEngine !== 'default') {
                return $this->makeEngine($channelEngine);
            }
        }
        
        // 2. Workspace override
        if ($workspaceId) {
            $workspaceEngine = $this->getWorkspaceSetting($workspaceId, 'agent_engine', 'default');
            if ($workspaceEngine !== 'default') {
                return $this->makeEngine($workspaceEngine);
            }
        }
        
        // 3. Platform override
        $platformKey = ($platform === 'aiva') ? 'CARINA_AIVA_ENGINE' : 'CARINA_ADMIN_ENGINE';
        $platformEngine = env($platformKey);
        if ($platformEngine) {
            return $this->makeEngine($platformEngine);
        }
        
        // 4. Global default
        return $this->makeEngine(env('CARINA_AGENT_ENGINE', 'carina'));
    }
}
```

### OPS Dashboard

The GUI adds columns for each granularity level:

```
Workspace    | Platform  | Telegram  | WhatsApp  | Email     | Web
-------------|-----------|-----------|-----------|-----------|------
Salim        | keprix    | keprix   | carina   | keprix   | keprix 
Papa Lord    | carina    | carina    | carina    | carina    | carina
Test         | keprix    | keprix   | keprix   | keprix   | carina

[Switch All to Keprix] [Emergency Rollback to Carina]
```

Each  is a dropdown toggle. Flip one channel without touching others.

### Admin Commands

```bash
# Global
php artisan agent-engine:switch-all keprix
php artisan agent-engine:switch-all carina

# Per platform
php artisan agent-engine:switch-platform aiva keprix
php artisan agent-engine:switch-platform admin carina

# Per workspace
php artisan agent-engine:switch-workspace ws_salim keprix

# Per channel
php artisan agent-engine:switch-channel ws_salim whatsapp carina
```

## Acceptance Criteria

- [x] `CARINA_AGENT_ENGINE=keprix` -> all workspaces use Keprix
- [x] `CARINA_AGENT_ENGINE=carina` -> all workspaces use original engine
- [x] Per-workspace override works: one workspace on Keprix, rest on Carina
- [x] Per-platform split works: Aiva on Keprix, Admin on Carina simultaneously
- [x] Per-channel override works: Telegram on Keprix, WhatsApp on Carina in same workspace
- [x] Resolution priority correct: channel > workspace > platform > global
- [x] Health check shows both engines' status
- [x] Switching engines does not lose session state
- [x] Emergency rollback completes in <30 seconds
- [x] All artisan commands work at each granularity level
