<?php

declare(strict_types=1);

return [
    /**
     * Platform-subsidised Carina messages (per workspace) before BYOK or paid included AI.
     * Tenants with a saved AI key in Settings are not counted.
     */
    'platform_quota' => [
        'trial_messages' => (int) env('CARINA_PLATFORM_TRIAL_MESSAGES', 25),
        'free_messages' => (int) env('CARINA_PLATFORM_FREE_MESSAGES', 5),
        'byok_preview_messages' => (int) env('CARINA_PLATFORM_BYOK_PREVIEW_MESSAGES', 10),
        'low_balance_threshold' => (int) env('CARINA_PLATFORM_LOW_BALANCE', 3),
        'lifetime_ttl_seconds' => (int) env('CARINA_PLATFORM_LIFETIME_TTL', 34_560_000),
    ],

    'rate_limits' => [
        'tenant_hourly' => (int) env('CARINA_RATE_TENANT_HOURLY', 500),
        'tenant_daily' => (int) env('CARINA_RATE_TENANT_DAILY', 5000),
        'user_hourly' => (int) env('CARINA_RATE_USER_HOURLY', 100),
        'user_daily' => (int) env('CARINA_RATE_USER_DAILY', 1000),
    ],

    'redis_ttl_seconds' => [
        'hourly' => 3600,
        'daily' => 86400,
    ],

    'rag' => [
        'chunk_size' => (int) env('CARINA_RAG_CHUNK_SIZE', 1000),
        'chunk_overlap' => (int) env('CARINA_RAG_CHUNK_OVERLAP', 200),
        'max_documents_per_tenant' => (int) env('CARINA_RAG_MAX_DOCUMENTS', 200),
        /** Minimum hybrid relevance score (0-1) before a chunk is ranked; 0 keeps all scored chunks. */
        'min_hybrid_score' => (float) env('CARINA_RAG_MIN_HYBRID_SCORE', 0),
        /** Expected embedding vector size (OpenAI text-embedding-3-small = 1536). */
        'embedding_dimensions' => (int) env('CARINA_EMBEDDING_DIMENSIONS', 1536),
    ],

    'conversation_retention_days' => (int) env('CARINA_CONVERSATION_RETENTION_DAYS', 90),

    'document_read' => [
        'max_chars' => (int) env('CARINA_DOC_READ_MAX_CHARS', 50000),
        'retention_hours' => (int) env('CARINA_DOC_READ_RETENTION_HOURS', 48),
    ],

    'prompt_cache_ttl' => (int) env('CARINA_PROMPT_CACHE_TTL', 3600),

    /** Directory containing Carina SKILL.md source files compiled by carina:compile-skills. */
    'skills_path' => env('CARINA_SKILLS_PATH', resource_path('carina/skills')),

    /**
     * When true, completed agent turns may auto-generate new skill files (queued).
     * Off by default; enable only when operators want session-driven skill curation.
     */
    'auto_skill_learn' => filter_var(env('CARINA_AUTO_SKILL_LEARN', false), FILTER_VALIDATE_BOOL),

    /**
     * Root directory for operator-curated Carina masterbrain markdown (default: config paths.brain.masterbrain).
     * Override in tests with a temp directory; leave empty for default. BRAIN_MASTERBRAIN_PATH sets the same default root for all code paths; CARINA_MASTERBRAIN_PATH wins in CarinaKnowledgeTrainingService when set.
     */
    'masterbrain_path' => env('CARINA_MASTERBRAIN_PATH'),

    /**
     * Platform Carina knowledge training (admin UI): security, OCR, ZIP, audit, RAG template tenant.
     */
    'training' => [
        'mime_strict' => filter_var(env('CARINA_TRAINING_MIME_STRICT', true), FILTER_VALIDATE_BOOL),
        /** Absolute path to clamscan binary; when empty, AV scan is skipped. */
        'clamscan_binary' => env('CARINA_TRAINING_CLAMSCAN_BINARY'),
        'pdf_fallback_enabled' => filter_var(env('CARINA_TRAINING_PDF_FALLBACK', true), FILTER_VALIDATE_BOOL),
        'ocr_enabled' => filter_var(env('CARINA_TRAINING_OCR', true), FILTER_VALIDATE_BOOL),
        'pdftotext_binary' => env('CARINA_TRAINING_PDFTOTEXT_BINARY'),
        'pdftoppm_binary' => env('CARINA_TRAINING_PDFTOPPM_BINARY'),
        'tesseract_binary' => env('CARINA_TRAINING_TESSERACT_BINARY'),
        /** Central tenant UUID recommended for internal RAG smoke tests (shown first in UI when set). */
        'template_tenant_id' => env('CARINA_TRAINING_TEMPLATE_TENANT_ID'),
        /** When true, successful masterbrain saves auto-queue RAG (overridable in platform_settings). */
        'auto_rag_after_save' => filter_var(env('CARINA_TRAINING_AUTO_RAG_AFTER_SAVE', false), FILTER_VALIDATE_BOOL),
        /** selected | all_active - used when auto_rag_after_save is on (overridable in platform_settings). */
        'auto_rag_scope' => env('CARINA_TRAINING_AUTO_RAG_SCOPE', 'selected'),
        'masterbrain_sync_max_files' => (int) env('CARINA_TRAINING_MASTERBRAIN_SYNC_MAX_FILES', 500),
        'masterbrain_sync_max_tenants' => (int) env('CARINA_TRAINING_MASTERBRAIN_SYNC_MAX_TENANTS', 500),
        /** Max extracted bytes from a single ZIP before refusing (defence in depth). */
        'zip_max_uncompressed_bytes' => (int) env('CARINA_TRAINING_ZIP_MAX_UNCOMPRESSED', 25_000_000),
        /** Max number of documents pulled from one ZIP. */
        'zip_max_entries' => (int) env('CARINA_TRAINING_ZIP_MAX_ENTRIES', 40),
    ],
];
