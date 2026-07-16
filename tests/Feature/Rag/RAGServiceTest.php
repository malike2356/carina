<?php

declare(strict_types=1);

/**
 * Section 13 -- Feature/Carina/RAGServiceTest (service lives under App\Services\Carina\RAGService)
 */

use App\Models\Rag\RagChunk;
use App\Models\Rag\RagDocument;
use App\Services\Carina\RAGService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

it('test_retrieve_context_returns_empty_string_when_no_documents', function (): void {
    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'RAG Empty '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@rag-empty.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    RagDocument::query()->create([
        'tenant_id' => $tenant->getTenantKey(),
        'name' => 'Draft',
        'type' => 'txt',
        'path' => $tenant->getTenantKey().'/draft.txt',
        'indexed_at' => null,
    ]);

    $tid = $tenant->getTenantKey();
    $block = app(RAGService::class)->retrieveContext('anything', $tid, $tid, 3);

    expect($block)->toBe('');

    tenancy()->end();
});

it('test_retrieve_context_returns_tenant_scoped_chunks_only', function (): void {
    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'RAG Ctx '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@rag-ctx.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    $tid = $tenant->getTenantKey();

    $mine = RagDocument::query()->create([
        'tenant_id' => $tid,
        'name' => 'Mine',
        'type' => 'txt',
        'path' => $tid.'/mine.txt',
        'indexed_at' => now(),
    ]);

    RagDocument::query()->create([
        'tenant_id' => $tid.'-other',
        'name' => 'Other',
        'type' => 'txt',
        'path' => $tid.'/other.txt',
        'indexed_at' => now(),
    ]);

    RagChunk::query()->create([
        'document_id' => $mine->id,
        'content' => 'ScopedPhraseXYZ '.$tid,
        'chunk_index' => 0,
        'created_at' => now(),
    ]);

    tenancy()->end();

    tenancy()->initialize($tenant);

    Http::preventStrayRequests();

    $stubVector = array_fill(0, 1536, 0.001);

    Http::fake(function (Request $request) use ($stubVector) {
        if (! str_contains($request->url(), '/embeddings')) {
            return Http::response(['error' => 'unexpected'], 404);
        }

        return Http::response([
            'data' => [['embedding' => $stubVector]],
            'usage' => ['prompt_tokens' => 1, 'total_tokens' => 1],
        ], 200);
    });

    $ctx = app(RAGService::class)->retrieveContext('ScopedPhraseXYZ', $tid, $tid, 5);

    expect($ctx)->not->toBe('')
        ->and($ctx)->toContain('ScopedPhraseXYZ');

    tenancy()->end();
    Http::allowStrayRequests();
});

it('test_search_documents_does_not_return_other_tenant_documents', function (): void {
    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'RAG Scope '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@rag-scope.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    $tid = $tenant->getTenantKey();

    $keep = RagDocument::query()->create([
        'tenant_id' => $tid,
        'name' => 'KeepMe',
        'type' => 'txt',
        'path' => $tid.'/keep.txt',
        'indexed_at' => now(),
    ]);

    RagDocument::query()->create([
        'tenant_id' => $tid.'-other-logical-key',
        'name' => 'OtherLogical',
        'type' => 'txt',
        'path' => $tid.'/other.txt',
        'indexed_at' => now(),
    ]);

    RagChunk::query()->create([
        'document_id' => $keep->id,
        'content' => 'UniqueKeeperPhrase '.$tid,
        'chunk_index' => 0,
        'created_at' => now(),
    ]);

    tenancy()->end();

    tenancy()->initialize($tenant);

    Http::preventStrayRequests();

    $stubVector = array_fill(0, 1536, 0.001);

    Http::fake(function (Request $request) use ($stubVector) {
        if (! str_contains($request->url(), '/embeddings')) {
            return Http::response(['error' => 'unexpected'], 404);
        }

        return Http::response([
            'data' => [['embedding' => $stubVector]],
            'usage' => ['prompt_tokens' => 1, 'total_tokens' => 1],
        ], 200);
    });

    $docs = app(RAGService::class)->searchDocuments('UniqueKeeperPhrase', $tid, $tid);

    expect($docs)->toHaveCount(1);
    expect($docs->first()->name)->toBe('KeepMe');

    tenancy()->end();
    Http::allowStrayRequests();
});

it('test_embed_document_sets_indexed_at', function (): void {
    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'RAG Embed '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@rag-embed.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    $tid = $tenant->getTenantKey();
    $relative = $tid.'/empty.txt';

    Storage::disk('local')->makeDirectory('rag/'.$tid);
    Storage::disk('local')->put('rag/'.$relative, '');

    $doc = RagDocument::query()->create([
        'tenant_id' => $tid,
        'name' => 'empty.txt',
        'type' => 'txt',
        'path' => $relative,
        'indexed_at' => null,
    ]);

    app(RAGService::class)->embedDocument($doc->id, $tid);

    $doc->refresh();

    expect($doc->indexed_at)->not->toBeNull();

    tenancy()->end();
});
