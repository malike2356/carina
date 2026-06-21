MAKING CARINA FAST AGAIN

Carina is slower because it does more work before it answers.

  The main latency sources in the code are:

  - Context assembly in carina/core.carinaai.uk/src/agents/carina.ts:120
    It can pull in personality, cross-agent context, contacts, persistent memory, recent session history, semantic memory search, RAG chunks, and skills. That is
    a lot more than a plain prompt-to-response loop.

  - Planner pass in carina/core.carinaai.uk/src/agents/orchestrator.ts:75
    For anything not classified as simple, Carina first calls a cheap LLM planner, then runs the actual answer path. That is an extra model round trip.

  - Embeddings and DB lookups in carina/core.carinaai.uk/src/memory/store.ts:43
    RAG search computes an embedding, then queries Postgres. That adds latency before the model even starts.

  - Fast-path is conditional
    The fast mode only kicks in for simple prompts. If the prompt looks even mildly complex, Carina takes the heavier route.

  - Model/provider choice
    The backend does not force a minimal-latency model. If Hermes is using a faster model or fewer layers, it will feel snappier even if both are “working
    correctly.”

  So the short answer is:

  Hermes likely feels faster because it is doing less orchestration. Carina is architected to be more capable, so it pays for that with extra context building,
  planning, memory retrieval, and sometimes multiple model calls.

  If you want Carina to feel closer to Hermes speed, the biggest wins are:

  1. keep the fast lane for short prompts,
  2. skip memory/RAG/skills unless the task truly needs them,
  3. avoid planner calls for borderline-simple requests,
  4. use the fastest configured model for chat.

  The code already has some of that, but the remaining overhead is real.

why are you faster that carina standalone?
────────────────────────────────────────


╭─  Hermes ─────────────────────────────────────────────────────────────────────────────────────────────────────────╮
    Good question. Let me think through the architecture honestly; I haven't run benchmarks, but I can reason from what each system does per request.
    
    
    
    Why Hermes (Me) Is Faster Than Carina Standalone
    
    1. Tool Execution Path
    
    Hermes: Tool call → native function invocation → result. Tools are compiled into the runtime. No HTTP, no serialization overhead beyond the model protocol.
    
    Carina: Tool call → Express route → middleware stack → tool handler → JSON response → back through middleware. Every tool invocation is an HTTP request/response cycle. 57 tools × HTTP overhead adds up fast on multi-step agent runs.
    
    
    
    2. Security Tax (Scout)
    
    Carina's pitch is security. That costs latency. Every request hits:
    
    
    Prompt guard (regex + ML) → anomaly detector → egress filter → 
    honeypot check → token bucket rate limiter → tool policy/tier check →
    THEN the actual tool executes
    
    
    Scout runs on a separate process (port 4444). If the core agent calls Scout synchronously per-tool-invocation, that's a network hop per step. Even on localhost, that's measurable.
    
    Hermes has none of this. No prompt guard, no anomaly detector, no egress filter. Simpler, faster, less secure.
    
    
    
    3. LLM Routing Overhead
    
    Hermes: Provider configured in config.yaml. One lookup. Done.
    
    Carina: LLMRouter.chatRouted() → extract tenantId → query tenant_provider_keys → AES-256-CBC decrypt → check if key exists → apply env override or fall back to global → THEN route to provider.
    
    Every. Single. Request. The BYOK system that saves Carina money costs Carina time.
    
    
    
    4. Runtime Stack
    
    Hermes: Likely Go or Rust for the agent runtime (Nous Research builds performant systems). Model inference is the bottleneck, not agent orchestration.
    
    Carina: Node.js Express. Single-threaded event loop. If one tool call blocks (file I/O, external API), the whole pipeline stalls. Node's fine for I/O-bound workloads, but agent orchestration is a mix of compute and I/O; not its sweet spot.
    
    
    
    5. Memory & Context Injection
    
    Hermes: Memory injected once at turn start. 2,181 chars, straight string interpolation. Session search is FTS5 over SQLite; sub-millisecond.
    
    Carina: 5 memory backends. Which one is active? If it's postgres, that's a network round-trip per retrieval. If mem0 is involved, that's an API call. Embeddings? Another model call. The "more sophisticated" memory system is also the slower one.
    
    
    
    6. The Real Reason: Maturity vs. Ambition
    
    
    Hermes:   "Do these 5 things, do them fast, do them reliably."
    Carina:   "Do EVERYTHING Hermes does PLUS security PLUS trust PLUS billing 
              PLUS compliance PLUS multi-tenant PLUS alerts PLUS SDK..."
    
    
    Carina is a superset on paper but pays for it with overhead. Every feature in the src/ tree is code that runs somewhere in the hot path; if not per-request, then at startup, or during tool discovery, or in middleware.
    
    Hermes doesn't have a Scout, a billing system, a trust stack, or 18 domain packs. What it has is fewer things, tuned harder.
    
    
    
    Summary
    
    Bottleneck: Tool execution
    Hermes: Native function call
    Carina: HTTP round-trip
    ────────────────────────────────────────
    Bottleneck: Security check
    Hermes: None
    Carina: Scout: prompt guard + anomaly + egress + honeypot + rate limit + policy
    ────────────────────────────────────────
    Bottleneck: Provider routing
    Hermes: Config lookup
    Carina: Tenant DB query + AES decrypt
    ────────────────────────────────────────
    Bottleneck: Memory retrieval
    Hermes: FTS5 SQLite
    Carina: Postgres/API/embeddings (depending on backend)
    ────────────────────────────────────────
    Bottleneck: Runtime
    Hermes: Compiled (Go/Rust likely)
    Carina: Node.js event loop
    ────────────────────────────────────────
    Bottleneck: Feature surface
    Hermes: Lean
    Carina: Superset (everything costs something)
    
    
    
    Carina is slower because it does more per request. That's not a bug; it's the tradeoff. Security, trust, and multi-tenancy aren't free. The question is whether the latency is worth what you get for it. For a paying Scout customer who needs on-chain attestations? Probably yes. For a quick grep and sed? Hermes wins every time.



