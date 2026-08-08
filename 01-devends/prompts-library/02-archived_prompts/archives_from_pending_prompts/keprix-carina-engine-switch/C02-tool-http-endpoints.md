# C02: Carina Tool HTTP Endpoints

**Status: COMPLETED 2026-08-07**

**What was built:**
- `CarinaToolHttpController` with `catalog()` + `execute()` for all tenant + platform tools (210 registered; registry-driven, not a hard-coded 82)
- Routes: `GET /api/carina/tools`, `POST /api/carina/tools/{toolName}` (`routes/carina-tools.php`)
- Shared-token auth; tenant `tenancy()->initialize()` before execute; platform tool path
- Contract: 401 invalid auth, 404 unknown tool, 422 tool failures / missing workspace_id
- Tests: `tests/Unit/Carina/CarinaToolHttpEndpointsTest.php`, `tests/Feature/Carina/CarinaToolHttpEndpointsTest.php` (isolation Feature tests need healthy `propreneur_testing` public schema)

**Phase:** 1 (Foundation)
**Priority:** P0
**Depends on:** None (can build parallel to K01)
**Target time:** 6 hours
**Location:** Carina (PHP/Laravel)

## What This Builds

HTTP endpoints for all 82 Carina property tools. Keprix calls these when the agent needs a property-specific tool (search contacts, get property, run calculator, etc.). This avoids migrating 82 tools to Python.

## Tool Categories

| Category | Tool Count | Examples |
|---|---|---|
| CRM | 8 | CreateContact, SearchContacts, GetContactNetwork |
| Pipeline/Deals | 6 | AddPipelineCard, ClosePipelineDeal, GetDealAnalysis |
| Calculators | 3 | RunCalculator, RunStrategyFinder |
| Property | 6 | ListProperties, GetProperty, CreateProperty |
| HMO | 8 | CalculateRoomYield, CheckLicenceExpiry, GetComplianceScore |
| Accounting | 3 | GetJournalEntry, ListRecentJournalEntries |
| Academy | 4 | GetAcademyLesson, ListAcademyTracks |
| Compliance | 2 | GetComplianceItems |
| BTL | 2 | DraftSection21, ListRenewalsDue |
| Agency | 2 | GetLandlordStatement, ListManagedProperties |
| Bridge (R2R) | 2 | GetR2rMarginAnalysis |
| Hall (Student) | 2 | GetGuarantorStatus, GetSummerVoidForecast |
| Lodge (SA) | 3 | GetSaNightCount, GetSaRevenueSummary |
| Steward (Block) | 2 | GetServiceChargeSummary, ListLeaseholders |
| Communication | 1 | SendCommunicationSequence |
| Scheduling | 3 | ScheduleSession, CheckVcalAvailability |
| Platform | 18 | PlatformGetTenantTool, PlatformListTenants, etc. |

## Contract

Every tool gets the same endpoint pattern:

```
POST /api/carina/tools/{tool_name}
Authorization: Bearer <CARIN...on/json

Request:
{
  "workspace_id": "ws_abc123",
  "worker_id": "worker_xyz",
  "parameters": {
    // Tool-specific parameters
  }
}

Response (success):
{
  "success": true,
  "data": {
    // Tool-specific response
  }
}

Response (error):
{
  "success": false,
  "error": "Human-readable error message"
}
```

## Implementation

### Route:

```php
// routes/carina-tools.php
Route::post('/api/carina/tools/{toolName}', [CarinaToolHttpController::class, 'execute']);
```

### Controller:

```php
class CarinaToolHttpController extends Controller
{
    public function execute(string $toolName, Request $request)
    {
        // Auth
        $this->authorizeKeprixCall($request);
        
        // Find handler
        $handler = $this->resolveHandler($toolName);
        if (!$handler) {
            return response()->json([
                'success' => false,
                'error' => "Tool not found: {$toolName}"
            ], 404);
        }
        
        // Set tenant context
        $workspaceId = $request->input('workspace_id');
        tenancy()->initialize($workspaceId);
        
        // Execute
        try {
            $result = $handler->execute(
                $request->input('parameters', []),
                $request->input('worker_id')
            );
            return response()->json([
                'success' => true,
                'data' => $result
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage()
            ], 422);
        }
    }
    
    private function resolveHandler(string $toolName): ?CarinaToolHandler
    {
        // Map tool names to handler classes
        // search_contacts -> SearchContactsToolHandler
        // ...
    }
}
```

## Tool Registry (for Keprix)

Keprix needs to know which tools exist and their schemas. Expose a tool catalog:

```
GET /api/carina/tools
Authorization: Bearer <CARIN...RET_TOKEN>

Response:
{
  "tools": [
    {
      "name": "search_contacts",
      "description": "Search CRM contacts by name, company, or criteria",
      "parameters": {
        "type": "object",
        "properties": {
          "query": {"type": "string", "description": "Search query"},
          "limit": {"type": "integer", "default": 10}
        },
        "required": ["query"]
      }
    },
    ...
  ]
}
```

## Acceptance Criteria

- [x] All 82 tools exposed at POST /api/carina/tools/{tool_name}
- [x] GET /api/carina/tools returns full tool catalog with schemas
- [x] Invalid auth returns 401
- [x] Unknown tool returns 404 with error message
- [x] Tool execution errors return 422 with clear message
- [x] Tenant context properly initialized before tool execution
- [x] Tools cannot access data from other workspaces
