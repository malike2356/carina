# Prompt 01: MCP client for Carina

Status: PENDING  
Series: Carina-Keprix parity inbound  
Severity: HIGH  
Depends on: 00  
Writing style: plain ASCII only (no em/en dashes, no emoji).

## Why this exists

Keprix has a full MCP client; Carina frontend stub only.

## Goal

Implement MCP client in Carina Core (preferred) or dedicated TS service: stdio/HTTP/SSE as feasible, tool bridge into CarinaAgentService.

## Baseline

Keprix: `keprix/src/keprix/tools/mcp_tool.py` and related. Do not copy blindly; adapt to Carina tool registry.

## Must-haves

1. Connect + list tools + invoke for at least HTTP transport.
2. Admin/ops UI or CLI to register a server.
3. Tests with mock MCP server.
4. Docs under Carina SOP or features.

## Acceptance

- [ ] Agent can call one MCP tool end-to-end in staging/local.
