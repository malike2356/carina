# Phase 2.2; Provider Switching Mid-Session

## Goal
Implement the ability to switch AI providers mid-conversation without losing context. Users can type `/model openai` or `/model deepseek` during a chat session. The agent switches to the new model on the next turn while preserving conversation history. This fulfills the "Switch LLM mid-session" claim on the comparison table.

## Files to create
```
packages/engine/src/
  routing/
    provider-switcher.ts; Mid-session provider switching logic
    provider-capabilities.ts; What each provider supports (vision, streaming, tools)
  commands/
    model-command.ts; /model command handler
```

## Files to modify
```
packages/engine/src/
  agent/
    agentic-loop.ts; Accept dynamic provider override per turn
  chat/
    chat-service.ts; Handle /model command in message pipeline
  config/
    provider-config.ts; Track active provider per session
```

## How it works

1. User types `/model openai`
2. Agent acknowledges: "Switched to OpenAI. Using gpt-4o."
3. Next message uses the new provider for API calls
4. Conversation history is preserved; the new model sees all previous messages
5. System prompt and tool definitions are reformatted for the new provider's API format
6. If the new provider doesn't support a feature (e.g., DeepSeek doesn't do vision), warn the user: "Note: DeepSeek does not support image analysis. Vision features will be unavailable."

## Supported providers and their capabilities
```
Provider      | Chat | Vision | Streaming | Tools/Functions
--------------|------|--------|-----------|----------------
deepseek      | Yes  | No     | Yes       | Yes
openai        | Yes  | Yes    | Yes       | Yes
anthropic     | Yes  | Yes    | Yes       | Yes
openrouter    | Yes  | Varies | Yes       | Yes
xai           | Yes  | No     | Yes       | No
ollama (local)| Yes  | No     | Yes       | Partial
```

## Commands
```
/model; Show current model
/model list; List available models
/model openai; Switch to OpenAI (uses default model)
/model openai gpt-4o; Switch to specific model
/model deepseek; Switch to DeepSeek
/model anthropic claude-sonnet-4; Switch to Claude
```

## Edge cases
- Switching mid-tool-call: wait for tool to complete, then switch
- Provider API key missing: "OpenAI API key not configured. Run 'carina config set providers.openai.api_key YOUR_KEY'"
- Provider unavailable: graceful fallback message, stay on current provider
- Vision request on non-vision provider: "This requires a vision-capable model. Switch to OpenAI or Anthropic?"

## Verification
```bash
carina chat
> /model deepseek
# Expected: "Switched to DeepSeek. Using deepseek-v4-pro."
> What's 2+2?
# Expected: Response from DeepSeek
> /model openai
# Expected: "Switched to OpenAI. Using gpt-4o."
> Describe this image: [upload]
# Expected: Image analysis from OpenAI (vision-capable)
> /model deepseek
> Describe this image: [upload]
# Expected: "Note: DeepSeek does not support image analysis."
```
