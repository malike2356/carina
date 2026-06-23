# Carina AI - Image Generation Capability

**Status:** Architecture specification (not yet built)  
**Implementation:** Follows existing provider rotation pattern  

---

## Current Status

Carina is currently **text-only**. She can describe what an image should look like, generate detailed specifications, and create descriptions that a designer could use - but she cannot generate the image itself.

Adding image generation unlocks significant use cases for property:

---

## Use Cases

| Use Case | Example Prompt | Value |
|---|---|---|
| **Property visualisation** | "Show me a modern kitchen for a 3-bed HMO in Manchester" | Developers visualise refurb before committing |
| **Before/after concepts** | "Transform this living room from dated to modern" | Investor marketing, planning permission support |
| **Floor plan generation** | "Generate a floor plan for a 5-bed HMO" | Compliance, listing presentations |
| **Social media graphics** | "Create an Instagram post announcing this deal" | Sourcer/client marketing |
| **Area mood boards** | "Show me the vibe of Birmingham Jewellery Quarter" | Area guide visuals |
| **Compliance diagrams** | "Draw a fire escape route for a 3-storey HMO" | HMO licence applications |
| **Property listing photos** | "Enhance this photo to show the potential of this room" | Estate agent listings |
| **Infographics** | "Create a yield comparison chart for Manchester postcodes" | Investor reports |

---

## Provider Options

Following the same multi-provider rotation model as chat:

| Provider | Model | Quality | Speed | Cost/Image | API |
|---|---|---|---|---|---|
| **OpenAI** | DALL-E 3 | Excellent | ~10s | £0.04 (standard) / £0.08 (hd) | `POST /v1/images/generations` |
| **OpenAI** | DALL-E 2 | Good | ~5s | £0.02 | Same endpoint |
| **Google** | Imagen | Excellent | ~8s | Included in Gemini API billing | `POST /v1/images/generations` (OpenAI-compatible) |
| **Stability AI** | Stable Diffusion XL | Very good | ~4s | ~£0.01 | `POST /v1/generation/{engine}/text-to-image` |
| **DeepSeek** | - | N/A | - | Not available | No image generation support |

**Recommended rotation:** DALL-E 3 (primary) → Imagen (fallback) → Stable Diffusion XL (budget)

---

## Implementation

### Image Generation Tool

```php
class GenerateImageTool extends CarinaTool
{
    public function name(): string
    {
        return 'generate_image';
    }

    public function description(): string
    {
        return 'Generate an image based on a text description. Useful for property visualisations, '
             . 'marketing graphics, floor plans, and compliance diagrams.';
    }

    public function inputSchema(): array
    {
        return [
            'type' => 'object',
            'properties' => [
                'prompt' => [
                    'type' => 'string',
                    'description' => 'Detailed description of the image to generate.',
                ],
                'style' => [
                    'type' => 'string',
                    'enum' => ['photorealistic', 'architectural', 'modern', 'vintage', 'diagram', 'sketch'],
                    'description' => 'Visual style of the output.',
                ],
                'size' => [
                    'type' => 'string',
                    'enum' => ['1024x1024', '1792x1024', '1024x1792'],
                    'description' => 'Image dimensions.',
                ],
                'reference_image' => [
                    'type' => 'string',
                    'description' => 'Optional URL of an image to use as reference / style guide.',
                ],
            ],
            'required' => ['prompt'],
        ];
    }

    public function execute(array $args, ?User $user, CarinaConversation $conversation): ToolResult
    {
        $provider = app(ImageRouterService::class)->selectProvider();

        $image = match ($provider) {
            'openai' => $this->dalleGenerate($args),
            'google' => $this->imagenGenerate($args),
            'stability' => $this->sdGenerate($args),
            default => throw new \RuntimeException("No image provider available"),
        };

        // Store the image URL and metadata
        $conversation->images()->create([
            'url' => $image['url'],
            'prompt' => $args['prompt'],
            'provider' => $provider,
            'size' => $args['size'] ?? '1024x1024',
        ]);

        return new ToolResult(true, "Image generated: {$image['url']}", [
            'url' => $image['url'],
            'provider' => $provider,
            'revised_prompt' => $image['revised_prompt'] ?? null,
        ]);
    }
}
```

### API Endpoint

```http
POST /v1/images/generate
Content-Type: application/json
Authorization: Bearer {api_key}

{
  "prompt": "A modern HMO kitchen in Manchester, bright white cabinets, breakfast bar, tiled splashback",
  "style": "photorealistic",
  "size": "1792x1024"
}

Response:
{
  "url": "https://carina.verlox.uk/storage/images/abc123.png",
  "revised_prompt": "A bright modern HMO kitchen in Manchester...",
  "provider_used": "openai",
  "model": "dall-e-3"
}
```

---

## Pricing & Metering

| Image Size | Tokens Charged | Rationale |
|---|---|---|
| DALL-E 3 (standard) | 2,500 tokens | ~£0.04 cost. 20x DeepSeek Q&A. |
| DALL-E 3 (hd) | 5,000 tokens | ~£0.08 cost. Premium quality. |
| DALL-E 2 | 1,250 tokens | ~£0.02 cost. Lower quality. |
| Imagen | 2,000 tokens | ~£0.03 cost. Good fallback. |
| Stable Diffusion | 1,000 tokens | ~£0.01 cost. Budget option. |

**Plan limits:**
| Tier | Images/mo | Include |
|---|---|---|
| Free | 0 | Failed:  |
| Pro | 10 | Trial |
| Pro+ | 50 | Included |
| Ultra | 200 | Included |
| Enterprise | 1,000+ | Custom |

---

## Technical Implementation

### Image Router

```php
class ImageRouterService
{
    private const PROVIDERS = ['openai', 'google', 'stability'];
    private const FALLBACK = ['openai' => 'google', 'google' => 'stability', 'stability' => null];

    public function selectProvider(): string
    {
        foreach (self::PROVIDERS as $provider) {
            if ($this->isAvailable($provider)) {
                return $provider;
            }
        }
        throw new \RuntimeException('No image provider available');
    }

    private function isAvailable(string $provider): bool
    {
        $key = config("ai.providers.{$provider}.api_key");
        if (empty($key)) {
            return false;
        }

        // Check circuit breaker
        if (app(ProviderCircuitBreaker::class)->isOpen("image:{$provider}")) {
            return false;
        }

        return true;
    }
}
```

### Image Storage

Generated images are stored on the application server's storage:

```
storage/app/public/images/
├── ab/cd/abc123def456.png     # Organised by first 4 chars of hash
├── ef/gh/efg789abc012.png
└── ...
```

Served via `storage/app/public` symlink → `/storage/images/{path}`.

Configurable to use S3-compatible storage (Backblaze B2, AWS S3, DigitalOcean Spaces) for higher scale:

```php
// config/filesystems.php
'images' => [
    'driver' => env('IMAGE_STORAGE_DRIVER', 'local'),
    'root' => storage_path('app/public/images'),
    'url' => env('APP_URL') . '/storage/images',
],
```

---

## File Structure

```
app/Services/Carina/Tools/
└── GenerateImageTool.php           # Agent tool for image generation

app/Services/Carina/
├── ImageRouterService.php          # Multi-provider image routing
└── Providers/
    ├── DallEProvider.php           # OpenAI DALL-E integration
    ├── ImagenProvider.php          # Google Imagen integration
    └── StableDiffusionProvider.php # Stability AI integration

app/Http/Controllers/Api/
└── ImageController.php             # REST API for image generation

app/Models/
└── GeneratedImage.php              # Image metadata model

database/migrations/
└── xxxx_create_generated_images_table.php

config/ai.php (extend providers array with image models)
```
