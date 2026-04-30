<?php

return [

    /*
     * Default provider used by CarinaService when no tenant preference is set.
     * Tenant can configure their own via BYOK settings.
     */
    'default_provider' => env('AI_DEFAULT_PROVIDER', 'anthropic'),

    'providers' => [
        'anthropic' => [
            'api_key'   => env('ANTHROPIC_API_KEY'),
            'base_url'  => env('ANTHROPIC_BASE_URL', 'https://api.anthropic.com/v1'),
            'model'     => env('ANTHROPIC_MODEL', 'claude-sonnet-4-6'),
            'max_tokens' => 4096,
        ],
        'openai' => [
            'api_key'  => env('OPENAI_API_KEY'),
            'base_url' => env('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
            'model'    => env('OPENAI_MODEL', 'gpt-4o-mini'),
            'max_tokens' => 4096,
        ],
        'groq' => [
            'api_key'  => env('GROQ_API_KEY'),
            'base_url' => env('GROQ_BASE_URL', 'https://api.groq.com/openai/v1'),
            'model'    => env('GROQ_MODEL', 'llama-3.3-70b-versatile'),
            'max_tokens' => 4096,
        ],
        'deepseek' => [
            'api_key'   => env('DEEPSEEK_API_KEY'),
            'base_url'  => env('DEEPSEEK_BASE_URL', 'https://api.deepseek.com/v1'),
            'model'     => env('DEEPSEEK_MODEL', 'deepseek-v4-flash'),
            'pro_model' => env('DEEPSEEK_PRO_MODEL', 'deepseek-v4-pro'),
            'max_tokens' => 4096,
        ],
        'openrouter' => [
            'api_key'  => env('OPENROUTER_API_KEY'),
            'base_url' => env('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1'),
            'model'    => env('OPENROUTER_MODEL', 'anthropic/claude-3.5-haiku'),
            'max_tokens' => 4096,
        ],
    ],

    /*
     * Priority order for chat — first provider with a valid key wins.
     * Override per-tenant via BYOK settings.
     */
    'priority' => explode(',', env('AI_PRIORITY', 'anthropic,groq,deepseek,openrouter,openai')),

    /*
     * Carina system persona — appended to every tenant context.
     */
    'carina_persona' => 'You are Carina, the AI assistant built into Propreneur — a property investment management platform for UK landlords and investors. You understand UK property law, lettings regulations, HMO licensing, BTL/BRR/R2R/SA strategies, yield calculations, and HMRC landlord rules. Be concise, precise, and proactive. Always use £ and UK-specific context. Never make up data — if you do not have information, say so clearly.',

];
