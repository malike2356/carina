# Prompt Guard

Three-layer prompt injection detection for user input and tool output.

## Layer 1: Regex (input)

Fast patterns on user messages before the LLM call:

- Ignore previous instructions
- Role override ("you are now a different assistant")
- System prompt override phrases
- Jailbreak framing
- Long base64 blobs
- Unicode escape sequences
- Special tokens (`[INST]`, `<|...|>`)

Returns `layer: 1` with matched pattern labels.

## Layer 2: Tool output patterns

Applied to HTTP bodies and file content returned to the model:

- HTML comments hiding instructions
- Zero-width characters
- URL redirect chains in text
- Markers like `ACTUAL INSTRUCTIONS`, `REAL TASK`

Returns `layer: 2` when matched.

## Layer 3: LLM judge

Calls an OpenAI-compatible chat endpoint (`LABYRINTH_LLM_ROUTER_URL`) with a fixed classifier system prompt. Expects JSON only:

```json
{"malicious": true, "confidence": 85, "reasoning": "..."}
```

Runs when layers 1-2 are inconclusive or for high-risk sessions. Timeout default: 3 seconds.

## Configuration

| Variable | Role |
|---|---|
| `LABYRINTH_LLM_ROUTER_URL` | Judge API base |
| `LABYRINTH_JUDGE_MODEL` | Model id (e.g. `deepseek/deepseek-chat`) |

On Carina, enable with `LABYRINTH_ENABLED=true`. On third-party stacks, use [OpenClaw proxy](/integration/openclaw).

## Reporting

Detections emit Scout events (`prompt_injection_detected`, severity `critical` or `breach`) and block the turn. Carina does not pass malicious content to the model.

## Tuning

Extend `INPUT_PATTERNS` and `TOOL_RESULT_PATTERNS` in `src/security/prompt-guard.ts` for organisation-specific threats. Keep layer 3 enabled for novel phrasing that regex misses.
