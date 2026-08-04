# Carina Agentic Architecture

**Date:** 7 May 2026
**Status:** Phase 3 shipped - 12 tools live, agent UI feedback, context enrichment, human-in-the-loop confirmation gate, 2 destructive tools.

---

## Assistant vs Agent

| | Assistant (before) | Agent (now) |
|---|---|---|
| **Interaction** | Q&A - ask, get answer | Task - ask, get **result** |
| **Output** | Text, advice, analysis | Actions + text confirmation |
| **Scope** | One response at a time | Multi-step reasoning to achieve a goal |
| **Tools** | None | Native function calling (calculator, CRM, deal/property, contacts, pipeline, compliance, sessions, destructive actions) |
| **Example** | "What's the BRR output for £200k?" | "Run BRR on £200k, find investors in Birmingham, save the best one as a contact." |

---

## Architecture

```
User message
     ↓
CarinaController::sendMessage()
     ↓ canUseAgentMode(user)?
     ├─ No  → CarinaService::chat()          (assistant mode, unchanged)
     └─ Yes → CarinaAgentService::agentChat()
                     ↓
            Build system prompt + history (CarinaService::buildAgentContext)
                     ↓
            Inject tool schemas (CarinaToolRegistry::anthropicSchemas)
                     ↓
            ┌─ CarinaService::agentTurn(messages, toolSchemas)
            │        ↓
            │   LLM response
            │        ↓
            │   stop_reason == tool_use?
            │        ├─ Yes → CarinaToolRegistry::find(name) → execute() → append tool_result → repeat (max 5)
            │        └─ No  → finalizeAssistantReplyPublic() → persistAgentResult() → return
            └─────────────────────────────────────────────────────────┘
```

---

## Why Native Tool Calling (not text parsing)

The previous plan in this doc proposed parsing tool calls from the LLM's free text response. **That approach is fragile and abandoned.**

Native tool calling works like this:
- Tool schemas are sent in the API request payload, not the prompt text.
- The model returns a structured `tool_use` content block - not free text with JSON embedded.
- Zero regex, zero text parsing. The model signals tool intent with 100% fidelity.
- When the loop finishes, the model writes a plain-text summary. That is persisted as the assistant message.

Anthropic (`tool_use` blocks) and OpenAI-compatible providers (`function_calling`) are both supported via `CarinaService::callAnthropicWithTools` and `callOpenAiCompatWithTools`. Anthropic is always tried first since it has the best tool-use support.

---

## Files

| File | Role |
|---|---|
| `app/Services/Carina/Tools/CarinaTool.php` | Abstract base: `name()`, `description()`, `inputSchema()`, `execute()`, `authorize()` |
| `app/Services/Carina/Tools/ToolResult.php` | Value object returned by every tool - `success`, `summary`, `data`, `error` |
| `app/Services/Carina/CarinaToolRegistry.php` | Singleton registry. `anthropicSchemas(user)` returns authorized tool schemas. |
| `app/Services/Carina/CarinaAgentService.php` | The loop. Orchestrates tool turns, executes tools, persists results. |
| `app/Services/Carina/CarinaService.php` | Added: `buildAgentContext()`, `agentTurn()`, `finalizeAssistantReplyPublic()`, `persistAgentResult()`, `callAnthropicWithTools()`, `callOpenAiCompatWithTools()`, `convertMessagesToOpenAi()` |
| `app/Http/Controllers/Tenant/CarinaController.php` | `sendMessage()` routes to `agentChat()` when `canUseAgentMode(user)` is true |
| `app/Providers/AppServiceProvider.php` | `CarinaToolRegistry` registered as singleton with all 12 tools |
| `app/Billing/BillingModule.php` | `CarinaAgent = 'carina_agent'` case added |
| `app/Services/Carina/CarinaAccessGate.php` | `canUseAgentMode(user)` - admin/property_manager + carina_agent billing module |

---

## Tools (Live)

### Phase 1

| Tool name | What it does | Authorized roles |
|---|---|---|
| `run_calculator` | Execute any of the 16 deal calculators and return structured outputs | admin, property_manager, investor |
| `search_contacts` | Search CRM contacts by name/email/company/phone | admin, property_manager, agent |
| `get_deal_analysis` | Retrieve a saved deal with metrics and linked property | admin, property_manager, investor |
| `create_contact` | Create a new CRM contact | admin, property_manager, agent |
| `get_property` | Retrieve property details and financials | admin, property_manager, investor |

### Phase 2

| Tool name | What it does | Authorized roles |
|---|---|---|
| `add_pipeline_card` | Create a Kanban card on a pipeline, optionally linked to a contact or property | admin, property_manager, agent |
| `update_contact` | Patch engagement stage, investor funnel stage, tags, or append a note | admin, property_manager, agent |
| `list_properties` | Search portfolio by postcode, city, strategy, or status | admin, property_manager, investor |
| `get_compliance_items` | List compliance items for a property or workspace, filterable by status/expiry horizon | admin, property_manager, investor |
| `schedule_session` | Book a viCal session with the current user as host; no deposit collected | admin, property_manager, agent, staff |

### Phase 3 (Confirmation Required)

| Tool name | What it does | Authorized roles |
|---|---|---|
| `delete_contact` | Soft-delete a CRM contact. Requires user confirmation. | admin, property_manager, agent |
| `close_pipeline_deal` | Mark a pipeline card as Won or Lost. Moves it to the appropriate closing stage. Requires user confirmation. | admin, property_manager, agent |

---

## Adding a New Tool

1. Create `app/Services/Carina/Tools/YourTool.php` extending `CarinaTool`.
2. Implement `name()`, `description()`, `inputSchema()`, `execute()`. Override `authorize()` if needed.
3. Register: `$registry->register($app->make(YourTool::class))` in `AppServiceProvider`.

No other changes needed - the registry, agent loop, and provider adapters pick it up automatically.

---

## Agent Mode Gate

**On:** `admin` and `property_manager` roles + `carina_agent` billing module active.
**Off:** All other roles, or if the module is not on the tenant's plan.
**Behaviour when off:** Falls through to `CarinaService::chat()` (assistant mode) - no error, no difference visible to the user except Carina won't take actions.

The gate is intentionally role-strict. Investors can chat but cannot trigger agent actions (they could create contacts, run calculators in ways that pollute shared workspace data).

---

## The Agent Loop in Detail

```php
// CarinaAgentService::agentChat()
while ($step < MAX_STEPS) {
    $turn = $carina->agentTurn($systemPrompt, $messages, $toolSchemas);

    if (no tool calls || stop_reason != 'tool_use') {
        // Done - persist user + assistant messages, return reply
        break;
    }

    // Append assistant turn (Anthropic raw_content with tool_use blocks)
    $messages[] = ['role' => 'assistant', 'content' => $turn['raw_content']];

    // Execute each tool
    foreach ($turn['tool_calls'] as $tc) {
        $result = $toolRegistry->find($tc['name'])->execute($tc['input'], $user, $conversation);
        $actionLog[] = [...];
        $resultBlocks[] = ['type' => 'tool_result', 'tool_use_id' => $tc['id'], 'content' => $result->toJson()];
    }

    // Append tool results as user turn (Anthropic protocol)
    $messages[] = ['role' => 'user', 'content' => $resultBlocks];
}

// If MAX_STEPS hit: call agentTurn with empty toolSchemas to force a text summary
```

**Message format in the loop:** Anthropic native (`tool_use` / `tool_result` content blocks). When falling back to OpenAI-compatible providers, `convertMessagesToOpenAi()` in `CarinaService` translates the Anthropic-format history to OpenAI function-calling format.

---

## Guardrails

| Risk | Mitigation |
|---|---|
| Infinite loop | `MAX_STEPS = 5` hard cap; final turn forced text-only (no tools) |
| Unknown tool | Returns `ToolResult(false, "Tool not found")` - loop continues, LLM sees the error |
| Tool throws exception | Caught in `executeTool()`, returns failure `ToolResult` - loop continues |
| Unauthorized tool | `authorize(user)` checked before `execute()` - failure `ToolResult` returned |
| Cost | Each multi-step chain uses more tokens. Token usage logged per turn via `aiUsage->logInvocation(..., ['agent_turn' => true])` |
| Destructive actions | Phase 1 tools are all low-risk reads or additive writes. Destructive tools (delete, update) planned for Phase 3 with human-in-the-loop confirmation. |

---

## Pricing Strategy

| Plan | Carina tier | What Carina does |
|---|---|---|
| Solo / Starter | **Assistant** | Answers questions, analyses deals, explains strategies |
| Professional / Growth | **Agent** | Executes actions, creates contacts, runs calculators, multi-step workflows |
| Enterprise | **Agent + Custom Tools** | API access, custom tool creation, priority routing |

The `carina_agent` billing module key gates agent mode. Enable it per plan in the platform billing admin.

---

## Phase Roadmap

**Phase 1 - Done:** Infrastructure (CarinaTool, CarinaToolRegistry, CarinaAgentService, provider adapters) + 5 live tools.

**Phase 2 - Done:** 5 additional tools - `add_pipeline_card`, `update_contact`, `list_properties`, `get_compliance_items`, `schedule_session`. `canScheduleSessions` added to CarinaAccessGate.

**Phase 2.5 - Done:** Agent UI feedback (action log chips, Agent badge in drawer header), context enrichment for property and pipeline system prompt blocks.

**Phase 3 - Done:** Human-in-the-loop confirmation gate.
- `CarinaTool::requiresConfirmation()` (default `false`) + `confirmationDescription()` - override in any destructive tool.
- `CarinaAgentService`: detects confirmation-required tools, pauses the loop, stores full agent state in cache (300s TTL), returns `requires_confirmation: true` + `pending_action` + `confirm_url`.
- `CarinaController::confirmAgentAction()` - `POST /carina/conversations/{conversation}/agent/confirm` - validates token + approved, calls `resumeFromConfirmation()`, returns same shape as `sendMessage`.
- Drawer: amber confirmation panel replaces the composer when `pendingConfirmation !== null`; composer and send button disabled until resolved; chained confirmations (second destructive tool in the resumed loop) re-surface the panel automatically.

**Done - Phase 3 destructive tools shipped:** `delete_contact`, `close_pipeline_deal` - both use `requiresConfirmation() → true`.

**Next:** Test coverage for Phase 3 tools, full-page conversation view agent UI parity, and additional destructive tools (delete pipeline, bulk-update contacts).
