# Phase 3.6 — Domain Pack System + Tool Registration

## Task
Build the domain pack architecture and tool registration API. This is what makes Carina extensible by users without code changes to Carina Core.

## Domain Pack System

### Architecture
```
domain-packs/
  property-uk/          ← Reference implementation (already built)
    prompts/            ← Domain-specific AI prompts
      property-valuation.md
      hmo-compliance.md
      deal-analysis.md
    tools/              ← Domain-specific tool implementations
      RightmoveScraperTool.php
      HmoComplianceChecker.php
    models/             ← Fine-tuned model configurations
      property-faq.json  (Ollama model config)
    data/               ← Static reference data
      uk-property-law.json
      portsmouth-hmo-regs.json
    SKILL.md            ← Pack manifest with metadata
  template/             ← Copy this directory to start a new pack
    prompts/
    tools/
    models/
    data/
    SKILL.md
```

### SKILL.md manifest format
```yaml
---
name: property-uk
version: 1.0.0
description: UK property investment tools, compliance checks, and deal analysis
author: Carina Community
license: MIT
carina_version: ">=1.0.0"
dependencies: []
prompts:
  - property-valuation
  - hmo-compliance
  - deal-analysis
tools:
  - RightmoveScraper
  - HmoComplianceChecker
models:
  - property-faq
data:
  - uk-property-law
  - portsmouth-hmo-regs
---
```

### Pack lifecycle
1. Discovery: Carina scans domain-packs/ on startup
2. Validation: Each pack's SKILL.md is validated against schema
3. Registration: Prompts, tools, models, and data are registered
4. Activation: Pack is available for use in any workspace
5. Hot-reload: Adding/removing a pack does not require restart

### Template pack
Create a `template/` pack that a developer can copy to start a new domain.
Include comments in every file explaining what to customize.
The template must work out of the box (a "hello world" domain pack).

### Documentation
Write docs/domain-packs.md covering:
- What domain packs are
- How to create one (copy template, customize, test)
- SKILL.md manifest specification
- How to write domain prompts
- How to implement domain tools
- How to configure domain models
- How to include static data
- How to test a pack
- How to share a pack

### Verification
Create a test pack from the template. Name it "restaurant-uk".
Add one prompt, one tool, one data file.
Verify Carina loads it and the tool is usable.
Delete the test pack. Verify clean removal.

## Tool Registration API

### Tool manifest
```json
{
  "name": "rightmove_scraper",
  "description": "Scrape Rightmove listings matching criteria",
  "parameters": {
    "location": { "type": "string", "required": true, "description": "Postcode or area" },
    "max_price": { "type": "number", "required": false },
    "min_bedrooms": { "type": "number", "required": false }
  },
  "handler": "DomainPacks\\PropertyUk\\Tools\\RightmoveScraper",
  "timeout": 30,
  "rate_limit": { "max_per_minute": 10 }
}
```

### Tool lifecycle
1. Register: Tool manifest loaded on startup
2. Validate: Parameters checked against schema
3. Execute: Handler::execute($params) called
4. Audit: Execution logged to Scout
5. Error: On failure, clean error returned, no crash

### Hot-reload
- Watch domain-packs/ directory for changes
- New tool file detected → register
- Tool file removed → unregister
- Tool file modified → re-register (wait for active calls to finish)

### Tool sandboxing
- Each tool runs in isolated context
- Tool failure must not crash the agent
- Tool timeout enforced (default 30s, configurable)
- Rate limiting enforced per tool per workspace

### Verification
```php
// Register a test tool
$manifest = ['name' => 'test_tool', 'handler' => 'TestTool::class'];
$registry->register($manifest);
$result = $registry->execute('test_tool', ['param' => 'value']);
assert($result->success);
```
