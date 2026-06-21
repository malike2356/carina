# Gap 23 - Prompt 01: /v1/models + /v1/chat/completions Endpoints

**Status: COMPLETED 2026-06-21**

**What was built:** `openai-compatible/models.ts`, `chat-completions.ts`, Bearer auth, gateway router integration.

**Gap:** 23 OpenAI-Compatible API Endpoints
**Prompt number:** 01 of 02
**Name:** Standard /v1/models and /v1/chat/completions endpoints
**Primary agent:** Claude Code
**Estimated hours:** 2 h
**Depends on:** Nothing

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Read first

1. `api/` -- existing REST API routes structure
2. `providers/` -- provider registry (model listing)
3. `gateway/router.ts` -- session management
4. OpenAI API spec: https://platform.openai.com/docs/api-reference

---

## Goal

### Step 1: Model Listing Endpoint

Create `api/openai-compatible/models.ts`:

```typescript
// GET /v1/models
// Returns OpenAI-format model list
router.get('/v1/models', authenticate, async (req, res) => {
  const providers = getProviderRegistry();
  const models: OpenAIModel[] = [];

  for (const [providerId, provider] of Object.entries(providers)) {
    for (const model of provider.listModels()) {
      models.push({
        id: `${providerId}/${model.id}`,
        object: 'model',
        created: model.createdAt || Math.floor(Date.now() / 1000),
        owned_by: providerId,
        // Carina extensions (clients can ignore)
        carina_capabilities: {
          thinking: model.supportsThinking || false,
          vision: model.supportsVision || false,
          tools: model.supportsTools || false,
          streaming: model.supportsStreaming || false,
        },
      });
    }
  }

  res.json({
    object: 'list',
    data: models,
  });
});

// GET /v1/models/:modelId
router.get('/v1/models/:modelId', authenticate, async (req, res) => {
  const [providerId, ...modelParts] = req.params.modelId.split('/');
  const modelId = modelParts.join('/');

  const provider = getProviderRegistry()[providerId];
  if (!provider) return res.status(404).json({ error: { message: `Provider ${providerId} not found`, type: 'not_found' } });

  const model = provider.getModel(modelId);
  if (!model) return res.status(404).json({ error: { message: `Model ${req.params.modelId} not found`, type: 'not_found' } });

  res.json({
    id: req.params.modelId,
    object: 'model',
    created: model.createdAt || Math.floor(Date.now() / 1000),
    owned_by: providerId,
  });
});
```

### Step 2: Chat Completions Endpoint

Create `api/openai-compatible/chat-completions.ts`:

```typescript
// POST /v1/chat/completions
// Supports: streaming (SSE), non-streaming, tool calls, function calling

interface ChatCompletionRequest {
  model: string; // "anthropic/claude-sonnet-4-6"
  messages: OpenAIMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  tools?: OpenAITool[];
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  user?: string; // maps to Carina session identity
  // Carina extensions:
  carina_session_id?: string; // reuse existing session
  carina_thinking_level?: string; // off/minimal/low/medium/high/xhigh/max/adaptive
}

router.post('/v1/chat/completions', authenticate, async (req, res) => {
  const body = req.body as ChatCompletionRequest;

  // 1. Resolve model (provider/model format)
  const [providerId, ...modelParts] = body.model.split('/');
  const modelId = modelParts.join('/');
  const provider = getProviderRegistry()[providerId];
  if (!provider) {
    return res.status(400).json({ error: { message: `Unknown provider: ${providerId}`, type: 'invalid_request_error' } });
  }

  // 2. Create or reuse session
  const sessionId = body.carina_session_id || await createEphemeralSession(
    body.user || req.auth.userId,
    'openai-api',
    providerId,
    modelId,
  );

  // 3. Convert OpenAI tools to Carina tool format
  const carinaTools = body.tools ? convertOpenAITools(body.tools) : undefined;

  // 4. Build Carina message format from OpenAI messages
  const carinaMessages = body.messages.map(convertOpenAIMessage);

  // 5. Handle streaming vs non-streaming
  if (body.stream) {
    // SSE streaming response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      const stream = await runAgentStream(sessionId, {
        messages: carinaMessages,
        model: modelId,
        provider: providerId,
        tools: carinaTools,
        temperature: body.temperature,
        maxTokens: body.max_tokens,
        thinkingLevel: body.carina_thinking_level,
      });

      for await (const chunk of stream) {
        if (chunk.type === 'delta') {
          res.write(`data: ${JSON.stringify({
            id: `chatcmpl-${sessionId.slice(0, 8)}`,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: body.model,
            choices: [{
              index: 0,
              delta: { content: chunk.content },
              finish_reason: null,
            }],
          })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({
        id: `chatcmpl-${sessionId.slice(0, 8)}`,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: body.model,
        choices: [{
          index: 0,
          delta: {},
          finish_reason: 'stop',
        }],
      })}\n\n`);

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (err) {
      res.write(`data: ${JSON.stringify({ error: { message: err.message, type: 'server_error' } })}\n\n`);
      res.end();
    }

  } else {
    // Non-streaming response
    try {
      const response = await runAgent(sessionId, {
        messages: carinaMessages,
        model: modelId,
        provider: providerId,
        tools: carinaTools,
        temperature: body.temperature,
        maxTokens: body.max_tokens,
        thinkingLevel: body.carina_thinking_level,
      });

      res.json({
        id: `chatcmpl-${sessionId.slice(0, 8)}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: body.model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: response.content,
            ...(response.toolCalls && {
              tool_calls: convertCarinaToolsToOpenAI(response.toolCalls),
            }),
          },
          finish_reason: response.toolCalls ? 'tool_calls' : 'stop',
        }],
        usage: {
          prompt_tokens: response.usage?.inputTokens || 0,
          completion_tokens: response.usage?.outputTokens || 0,
          total_tokens: (response.usage?.inputTokens || 0) + (response.usage?.outputTokens || 0),
        },
      });
    } catch (err) {
      res.status(500).json({
        error: { message: err.message, type: 'server_error' },
      });
    }
  }
});
```

### Step 3: Authentication

OpenAI-compatible endpoints use Bearer token auth:

```typescript
// api/openai-compatible/auth.ts
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      error: { message: 'Missing or invalid Authorization header', type: 'authentication_error' },
    });
  }

  const token = authHeader.slice(7);

  // Accept: Carina API keys, Hub tokens, or paired device tokens
  const authResult = verifyToken(token);
  if (!authResult.valid) {
    return res.status(401).json({
      error: { message: 'Invalid API key', type: 'authentication_error' },
    });
  }

  req.auth = authResult;
  next();
}
```

### Step 4: Tool Conversion Layer

Convert between OpenAI tool format and Carina's internal format:

```typescript
function convertOpenAITools(openaiTools: OpenAITool[]): CarinaTool[] {
  return openaiTools.map(tool => ({
    name: tool.function.name,
    description: tool.function.description,
    parameters: tool.function.parameters,
    // Carina extensions preserved for return conversion
    _openai_original: tool,
  }));
}

function convertCarinaToolsToOpenAI(carinaToolCalls: any[]): OpenAIToolCall[] {
  return carinaToolCalls.map(tc => ({
    id: tc.id,
    type: 'function',
    function: {
      name: tc.name,
      arguments: JSON.stringify(tc.parameters),
    },
  }));
}
```

---

## Existing Carina code to integrate with

- `api/` -- new `openai-compatible/` route group
- `gateway/router.ts` -- register /v1/* routes before other middleware
- `providers/` -- model listing, tool compatibility checks
- `auth/` -- token verification for Bearer auth
- `config/schema.ts` -- `CARINA_OPENAI_API_ENABLED` (default false)
