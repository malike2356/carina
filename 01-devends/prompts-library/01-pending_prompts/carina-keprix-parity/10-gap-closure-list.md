# Carina / Aiva adopt Keprix strengths: gap closure list

Updated: 2026-08-04

This note turns the remaining parity prompts into a concrete closure list against the current Carina tree.
It is not a promise that every item is already complete. It is a working map of what is present, what is partial, and what still needs a build pass.

## Confirmed current tree

- MCP server management already exists in the web UI.
- MCP backend already has registry, tool discovery, test ping, connect, disconnect, and tool call plumbing.
- Browser assist surfaces already exist in the workspace UI.
- Terminal and control surfaces already exist in the workspace UI.
- GitHub memory bridge and scoped sync already exist.
- Upgrade and lifecycle helpers exist in the backend and CLI, but there is no dedicated web lifecycle surface yet.

## Concrete gap closure map

| Prompt | Current tree state | Gap to close | Next useful patch |
|---|---|---|---|
| 00 overview and guardrails | Present as prompt set framing | Needs a living implementation map, not just a README | Keep this note current and link it from the set README |
| 01 MCP client | Partial | Web UI could manage servers, but live connect, disconnect, and tool invocation were not exposed in the browser | Finish the MCP web control surface and tool execution flow |
| 02 subagents delegation | Partial | Delegation exists in backend behavior, but there is no first-class operator surface for it | Add a control surface and status view for delegation paths |
| 03 TUI or Keprix client | Partial | There is no single web-visible client selector or parity surface for local shell style workflows | Add a client or shell style control entry point in the workspace |
| 04 voice multi-provider phone | Partial | Voice and calling are scattered across adapters and flows | Add a clear provider and channel control path for voice |
| 05 vector memory backend | Partial | Memory sync exists, but the operator needs clearer control and visibility | Add a memory sync dashboard and per-scope controls |
| 06 browser tools | Partial | Browser assists exist, but not as a single controlled capability surface | Add a browser tools control and permission view |
| 07 self-knowledge introspection | Partial | Knowledge and help content exist, but not as a dedicated introspection report | Add a self-knowledge page or report view |
| 08 upgrade lifecycle | Partial | Upgrade helpers exist, but not a web-first lifecycle surface | Add a visible upgrade and update status page |
| 09 tests cutover archive | Partial | Archive and validation rules exist, but no simple operator-facing summary page | Add a build and archive validation summary page |

## Highest value patch chosen now

The next highest value item is MCP browser control:

- connect a saved server live
- disconnect it from the browser
- call a tool from the web UI
- show the result in the same panel

That closes a real control gap with existing backend code instead of introducing a new subsystem.

## Notes

- Keep product separation intact. Do not create a second runtime.
- Keep the prompt set honest. If a feature is partial, say partial.
- When a prompt becomes fully built, archive it immediately and remove empty folders.
