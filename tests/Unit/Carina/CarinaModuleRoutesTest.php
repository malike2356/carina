<?php

declare(strict_types=1);

/**
 * Executable checklist: tenant Carina + RAG JSON routes registered (matches `brain/prompts/07-carina-core`, `08-carina-rag`).
 * Lives under Unit so Pest does not apply RefreshDatabase (no DB required).
 */
it('registers tenant Carina JSON, RAG JSON, and Carina Blade route names', function (): void {
    $registered = collect(app('router')->getRoutes())
        ->map(fn ($r) => $r->getName())
        ->filter()
        ->values();

    foreach ([
        'tenant.api.carina.chat',
        'tenant.api.carina.chat.stream',
        'tenant.api.carina.conversations',
        'tenant.api.carina.conversations.clear',
        'tenant.api.carina.conversations.show',
        'tenant.api.carina.conversations.transcript',
        'tenant.api.carina.conversations.delete',
        'tenant.api.carina.usage',
        'tenant.api.carina.system-prompts.index',
        'tenant.api.carina.system-prompts.store',
        'tenant.api.carina.system-prompts.update',
        'tenant.api.carina.system-prompts.destroy',
        'tenant.api.carina.system-prompts.set-default',
        'tenant.api.carina.settings',
        'tenant.api.carina.settings.update',
    ] as $name) {
        expect($registered)->toContain($name);
    }

    foreach ([
        'tenant.api.rag.documents.upload',
        'tenant.api.rag.documents.index',
        'tenant.api.rag.documents.show',
        'tenant.api.rag.documents.destroy',
        'tenant.api.rag.documents.reindex',
        'tenant.api.rag.search',
        'tenant.api.rag.hybrid-search',
        'tenant.api.rag.sources.index',
        'tenant.api.rag.sources.update',
        'tenant.api.rag.sources.sync',
    ] as $name) {
        expect($registered)->toContain($name);
    }

    foreach ([
        'admin.carina.index',
        'admin.carina.start',
        'admin.carina.message',
        'admin.carina.speech-transcribe',
        'admin.carina.transcript',
        'admin.carina.show',
        'admin.carina.destroy',
    ] as $name) {
        expect($registered)->toContain($name);
    }

    foreach ([
        'tenant.carina.fromDeal',
        'tenant.carina.fromDealCalculator',
        'tenant.carina.fromDealCalculator.post',
        'tenant.carina.fromProperty',
        'tenant.carina.fromContact',
        'tenant.carina.fromPipeline',
        'tenant.carina.fromCompliance',
        'tenant.carina.fromReport',
        'tenant.carina.fromCourse',
        'tenant.carina.fromCommunityPost',
        'tenant.carina.fromMentorship',
        'tenant.carina.fromPipelineDeal',
        'tenant.carina.fromJournalEntry',
        'tenant.carina.fromAccountingHub',
        'tenant.carina.fromListingSources',
        'tenant.carina.fromVcalBooking',
        'tenant.carina.index',
        'tenant.carina.start',
        'tenant.carina.preferences',
        'tenant.carina.message',
        'tenant.carina.speech-transcribe',
        'tenant.carina.widget.bootstrap',
        'tenant.carina.transcript',
        'tenant.carina.show',
        'tenant.carina.destroy',
    ] as $name) {
        expect($registered)->toContain($name);
    }
});
