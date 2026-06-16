# Prompt 13 - Security, Auth, and Approvals

You are working in the Carina repository.

Goal: adopt the security and authorization controls that the other agents already treat as table stakes.

Read first:
- `instructions/prompts/researched_gap/agent_research/DEEP-GAPS-REPORT.md`
- `instructions/prompts/researched_gap/agent_research/CROSS-AGENT-ARCHITECTURE.md`
- `instructions/prompts/researched_gap/3-agents-to-adopt/` relevant security and auth files

Implement the missing guardrails:
- URL and path safety
- tool security policy
- approval workflow
- redaction for sensitive text
- security audit or doctor checks
- auth rate limiting
- admin versus non-admin tool policy
- allowlist-first defaults for dangerous actions
- device auth or OAuth where needed

Acceptance criteria:
- dangerous operations are gated
- sensitive output is redacted where appropriate
- auth and approval paths are explicit
- tests cover at least one blocked and one allowed security path

