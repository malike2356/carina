# Phase 5.1 — Model Routing with Local Models

## Task
Implement the model routing layer. Carina automatically routes queries between local models (Ollama) and cloud models based on task complexity, cost, and capability requirements.

## Specification

### Architecture
```
User Query
    |
    v
Task Classifier (local, fast)
    |
    +-- Simple query? --> Local Ollama model (free, fast)
    +-- Domain-specific? --> Fine-tuned local model (free, accurate)
    +-- Complex reasoning? --> Cloud model (capable, paid)
    +-- Vision task? --> Cloud vision model
    +-- Offline? --> Local fallback with degraded capabilities
```

### Task classifier
Classify incoming queries into:
1. simple: "What's my portfolio summary?" — local, fast
2. domain: "Is this HMO compliant in Portsmouth?" — fine-tuned local
3. complex: "Analyze this 50-page deal pack and compare 3 exit strategies" — cloud
4. vision: "Read the floor plan image" — cloud vision
5. code: "Write a PHP migration" — cloud

### Ollama integration
- Detect Ollama installation (check for ollama binary)
- If not installed: guide user through setup, fall back to cloud-only
- Model management: pull, list, remove models via ollama CLI
- Bundled models: ship Carina with a recommended property model
- Auto-update: check for updated models periodically

### Model configuration
```json
{
  "local": {
    "provider": "ollama",
    "default_model": "carina-property-v1",
    "fallback_model": "mistral:7b",
    "max_tokens": 2048
  },
  "cloud": {
    "primary": { "provider": "anthropic", "model": "claude-sonnet-4" },
    "secondary": { "provider": "openrouter", "model": "deepseek-v4" },
    "vision": { "provider": "anthropic", "model": "claude-sonnet-4" }
  }
}
```

### Cost tracking
- Per-request: model used, tokens in/out, estimated cost
- Per-session: total tokens, total cost, local vs cloud ratio
- Per-month: cumulative costs, savings from local routing
- Report: "You saved $47 this month by routing 73% of queries locally"

### Fallback chain
1. Try primary cloud model
2. If timeout/error: try secondary cloud model
3. If all cloud fails: try local model (even for complex queries)
4. If all fail: return graceful error message

### Cost optimization
- Simple queries under 500 tokens: always local
- Domain queries under 1000 tokens: fine-tuned local
- Complex queries over 1000 tokens: cloud, with cost estimate shown
- Late night / weekend: prefer local (lower urgency)
- Budget cap: configurable monthly limit, warn at 80%, block at 100%

## Implementation notes
- Ollama runs as a local service (ollama serve)
- Model files stored in ~/.ollama/models/
- Fine-tuned model: created via Ollama's modelfile, shipped as GGUF
- Task classifier: uses a small local model for classification itself
- All routing decisions logged to Scout audit trail

## Verification
```bash
# Test local routing
carina chat "What's my portfolio summary?"
# Expected: uses local model, costs $0

# Test cloud routing  
carina chat "Analyze this 50-page document..."
# Expected: uses cloud model, shows cost estimate

# Test offline mode
# Disconnect internet, send query
# Expected: gracefully degrades to local model

# Check savings report
carina usage --month
# Expected: shows local vs cloud breakdown with cost savings
```
