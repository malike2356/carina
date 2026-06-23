# Gap 23 - Prompt 02: /v1/responses + /v1/embeddings Endpoints

**Status: COMPLETED 2026-06-21**

**What was built:** `responses-embeddings.ts`, embeddings via memory embedder, web-server mount behind `CARINA_OPENAI_API_ENABLED`.

**Gap:** 23 OpenAI-Compatible API Endpoints
**Prompt number:** 02 of 02
**Name:** OpenResponses API + embeddings endpoint + SDK compatibility testing
**Primary agent:** Claude Code
**Estimated hours:** 1-2 h
**Depends on:** 01-chat-completions.md

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Goal

### 1. OpenResponses API

The newer OpenAI Responses API (`/v1/responses`) is simpler than chat completions:

```typescript
// POST /v1/responses
// https://platform.openai.com/docs/api-reference/responses

interface ResponsesRequest {
  model: string;
  input: string | Array<{ role: string; content: string }>;
  instructions?: string; // system prompt
  stream?: boolean;
  temperature?: number;
  max_output_tokens?: number;
  tools?: OpenAITool[];
  tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; name: string };
  previous_response_id?: string; // continue a previous response
}

router.post('/v1/responses', authenticate, async (req, res) => {
  const body = req.body as ResponsesRequest;

  // Convert to internal format
  let messages: CarinaMessage[];

  if (typeof body.input === 'string') {
    messages = [{ role: 'user', content: body.input }];
  } else {
    messages = body.input.map(convertOpenAIMessage);
  }

  // Add instructions as system message
  if (body.instructions) {
    messages.unshift({ role: 'system', content: body.instructions });
  }

  // Route to chat completions handler (reuse logic)
  req.body = {
    model: body.model,
    messages,
    stream: body.stream,
    temperature: body.temperature,
    max_tokens: body.max_output_tokens,
    tools: body.tools,
    tool_choice: body.tool_choice,
  };
  return chatCompletionsHandler(req, res);
});
```

### 2. Embeddings Endpoint

```typescript
// POST /v1/embeddings
router.post('/v1/embeddings', authenticate, async (req, res) => {
  const { model, input } = req.body;

  if (!input) {
    return res.status(400).json({ error: { message: 'input is required', type: 'invalid_request_error' } });
  }

  // Normalize input to array
  const inputs = Array.isArray(input) ? input : [input];

  try {
    const provider = getEmbeddingProvider(model);
    const embeddings = await provider.embed(inputs);

    res.json({
      object: 'list',
      data: embeddings.map((embedding, i) => ({
        object: 'embedding',
        index: i,
        embedding,
      })),
      model,
      usage: {
        prompt_tokens: estimateTokens(inputs),
        total_tokens: estimateTokens(inputs),
      },
    });
  } catch (err) {
    res.status(500).json({ error: { message: err.message, type: 'server_error' } });
  }
});
```

### 3. SDK Compatibility

Test with standard OpenAI SDKs to verify compatibility:

```bash
# Python
pip install openai
python3 -c "
from openai import OpenAI
client = OpenAI(base_url='http://localhost:3333/v1', api_key='carina_key_...')
response = client.chat.completions.create(
  model='anthropic/claude-sonnet-4-6',
  messages=[{'role': 'user', 'content': 'Hello!'}],
)
print(response.choices[0].message.content)
"

# Node.js
import OpenAI from 'openai';
const client = new OpenAI({ baseURL: 'http://localhost:3333/v1', apiKey: 'carina_key_...' });
const response = await client.chat.completions.create({
  model: 'anthropic/claude-sonnet-4-6',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

### 4. Configuration

```bash
# Enable OpenAI-compatible API
CARINA_OPENAI_API_ENABLED=true
CARINA_OPENAI_API_PORT=3333     # defaults to CARINA_PORT if not set
```

---

## Existing Carina code to integrate with

- `api/openai-compatible/` -- add `responses.ts` and `embeddings.ts`
- `providers/` -- embedding provider resolution
- `gateway/router.ts` -- register /v1/responses, /v1/embeddings
- `config/schema.ts` -- `CARINA_OPENAI_API_ENABLED`
