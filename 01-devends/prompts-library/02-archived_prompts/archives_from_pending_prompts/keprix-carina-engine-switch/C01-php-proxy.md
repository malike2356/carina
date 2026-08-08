# C01: Carina PHP Proxy to Keprix

**Status: COMPLETED 2026-08-07**
**Phase:** 1 (Foundation)
**Priority:** P0
**Depends on:** K01 (Keprix agent contract endpoint live)
**Target time:** 8 hours
**Location:** Carina (PHP/Laravel)

## What was built

- `app/Services/Carina/KeprixBridgeService.php` + `Dto/AgentResponse.php` + `KeprixUnavailableException`
- Thin `CarinaService.php` (254 lines) proxies chat/agent turns to Keprix
- Native agent loop preserved as `CarinaNativeAgentService.php` for C03 rollback
- `CarinaAgentService` short-circuits to Keprix when `carina.keprix.enabled`
- Tool callback route `POST /api/carina/tools/{toolName}` (`CarinaToolHttpController`)
- Config/env: `CARINA_KEPRIX_*`; tests in `tests/Unit/Carina/KeprixBridgeServiceTest.php` (11 passed)

## What This Builds

Replace Carina's custom agent loop with a thin PHP proxy that calls Keprix. `CarinaService.php` shrinks from 2,810 lines to ~200. The agent loop (build prompt -> call LLM -> parse -> run tool -> loop) becomes a single HTTP call.

## What Gets Replaced

### Before (Carina v1)

```
CarinaService.php (2,810 lines):
  - Prompt assembly
  - LLM API calling
  - Response parsing
  - Tool call detection
  - Tool execution loop
  - Tool result injection
  - Session state management
  - Memory injection
  - Streaming
```

### After (Carina v2)

```
CarinaService.php (~200 lines):
  - Workspace resolution
  - Auth check
  - Format messages for Keprix contract
  - POST /carina/agent/run -> Keprix
  - Parse Keprix response
  - Return to user
```

## Implementation

### File: `app/Services/Carina/KeprixBridgeService.php`

```php
class KeprixBridgeService
{
    private string $keprixUrl;
    private string $sharedToken;
    private HttpClient $http;
    
    public function __construct()
    {
        $this->ke...RIX_URL', 'http://localhost:8333');
        $this->sharedToken = env('CARINA_KEPRIX_SHARED_TOKEN');
        $this->http = Http::timeout(30)
            ->withHeaders(['Authorization' => "Bearer {$this->sharedToken}"]);
    }
    
    public function runAgentTurn(
        string $workspaceId,
        string $sessionId,
        string $model,
        float $temperature,
        string $systemPrompt,
        array $messages,
        array $tools,
        array $carinaTools
    ): AgentResponse {
        $response = $this->http->post("{$this->keprixUrl}/carina/agent/run", [
            'workspace_id' => $workspaceId,
            'session_id' => $sessionId,
            'model' => $model,
            'temperature' => $temperature,
            'system_prompt' => $systemPrompt,
            'messages' => $messages,
            'tools' => $tools,
            'carina_tools' => $carinaTools,
        ]);
        
        if (!$response->successful()) {
            throw new KeprixUnavailableException(
                "Keprix agent engine unavailable: HTTP {$response->status()}"
            );
        }
        
        return AgentResponse::fromArray($response->json());
    }
    
    public function healthCheck(): bool
    {
        try {
            $response = $this->http->get("{$this->keprixUrl}/health");
            return $response->successful();
        } catch (\Exception $e) {
            return false;
        }
    }
}
```

### File: `app/Services/Carina/CarinaService.php` (simplified)

```php
class CarinaService
{
    private KeprixBridgeService $keprix;
    
    public function chat(string $workspaceId, string $message, array $context = []): string
    {
        // 1. Resolve workspace configuration
        $workspace = $this->resolveWorkspace($workspaceId);
        $worker = $this->getWorker($workspace);
        
        // 2. Build messages array from conversation history
        $messages = $this->buildMessages($workspaceId, $message, $context);
        
        // 3. Get tools available to this worker
        $tools = $this->getWorkerTools($worker);
        $carinaTools = $this->formatToolsForKeprix($tools);
        
        // 4. Call Keprix
        $response = $this->keprix->runAgentTurn(
            workspaceId: $workspaceId,
            sessionId: $context['session_id'] ?? null,
            model: $workspace->preferred_model ?? 'deepseek-v4-pro',
            temperature: 0.7,
            systemPrompt: $worker->system_prompt,
            messages: $messages,
            tools: $tools,
            carinaTools: $carinaTools,
        );
        
        // 5. Update local session
        $this->updateSession($workspaceId, $response->sessionId);
        
        // 6. Return response to user
        return $response->message->content;
    }
}
```

## Tool Callback Endpoint

Keprix will call back to Carina for property-specific tools. This endpoint must exist:

### File: `routes/carina-tools.php`

```php
Route::post('/api/carina/tools/{toolName}', function (string $toolName, Request $request) {
    // Auth check
    if ($request->header('Authorization') !== 'Bearer ' . env('CARINA_KEPRIX_SHARED_TOKEN')) {
        return response()->json(['error' => 'Unauthorized'], 401);
    }
    
    // Route to existing tool handler
    $handler = app("carina.tool.handler.{$toolName}");
    if (!$handler) {
        return response()->json(['error' => "Unknown tool: {$toolName}"], 404);
    }
    
    $result = $handler->execute($request->all());
    return response()->json($result);
});
```

## Acceptance Criteria

- [x] CarinaService chat() calls Keprix instead of calling LLM directly
- [x] Response format matches what Aiva frontend expects (no UI changes needed)
- [x] Keprix unavailable -> graceful error returned to user (not 500 crash)
- [x] Session IDs persist across turns
- [x] Tool calls route correctly: standard tools on Keprix, property tools callback to Carina
- [x] CarinaService.php reduced to under 300 lines
- [x] Unit/contract tests pass with Keprix as backend (feature DB env blocked locally)
