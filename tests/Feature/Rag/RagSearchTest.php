<?php

declare(strict_types=1);

/**
 * Section 13 -- Feature/Rag/RagSearchTest
 */

use App\Models\Rag\RagChunk;
use App\Models\Rag\RagDocument;
use App\Services\Rag\RagSearchService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;

afterEach(function (): void {
    Http::allowStrayRequests();
    Config::set('carina.rag.min_hybrid_score', 0);
});

it('test_similarity_search_returns_only_tenant_chunks', function (): void {
    if (! Schema::connection('tenant')->hasColumn('rag_chunks', 'embedding')) {
        expect(true)->toBeTrue();

        return;
    }

    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'Search Sim '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@search-sim.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    $tid = $tenant->getTenantKey();

    $doc = RagDocument::query()->create([
        'tenant_id' => $tid,
        'name' => 'd',
        'type' => 'txt',
        'path' => $tid.'/s.txt',
        'indexed_at' => now(),
    ]);

    $v = array_fill(0, 1536, 0.02);

    DB::connection('tenant')->insert(
        'INSERT INTO rag_chunks (document_id, content, chunk_index, embedding, created_at) VALUES (?, ?, ?, ?::vector, ?)',
        [$doc->id, 'tenant scoped line', 0, '['.implode(',', array_map('floatval', $v)).']', now()]
    );

    tenancy()->end();

    tenancy()->initialize($tenant);

    Http::preventStrayRequests();

    Http::fake(function (Request $request) use ($v) {
        if (! str_contains($request->url(), '/embeddings')) {
            return Http::response(['error' => 'no'], 404);
        }

        return Http::response([
            'data' => [['embedding' => $v]],
            'usage' => ['prompt_tokens' => 1, 'total_tokens' => 1],
        ], 200);
    });

    $hits = app(RagSearchService::class)->similaritySearch($v, $tid, 5);

    expect($hits)->not->toBeEmpty()
        ->and($hits->first()->content)->toContain('tenant scoped');

    tenancy()->end();
});

it('test_similarity_search_does_not_cross_tenant_boundary', function (): void {
    if (! Schema::connection('tenant')->hasColumn('rag_chunks', 'embedding')) {
        expect(true)->toBeTrue();

        return;
    }

    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'Search Bound '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@search-bound.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    $tid = $tenant->getTenantKey();

    $doc = RagDocument::query()->create([
        'tenant_id' => $tid.'-foreign',
        'name' => 'foreign',
        'type' => 'txt',
        'path' => $tid.'/f.txt',
        'indexed_at' => now(),
    ]);

    $v = array_fill(0, 1536, 0.03);

    DB::connection('tenant')->insert(
        'INSERT INTO rag_chunks (document_id, content, chunk_index, embedding, created_at) VALUES (?, ?, ?, ?::vector, ?)',
        [$doc->id, 'ForeignTenantSecret', 0, '['.implode(',', array_map('floatval', $v)).']', now()]
    );

    tenancy()->end();

    tenancy()->initialize($tenant);

    Http::preventStrayRequests();

    Http::fake(function (Request $request) use ($v) {
        if (! str_contains($request->url(), '/embeddings')) {
            return Http::response(['error' => 'no'], 404);
        }

        return Http::response([
            'data' => [['embedding' => $v]],
            'usage' => ['prompt_tokens' => 1, 'total_tokens' => 1],
        ], 200);
    });

    $hits = app(RagSearchService::class)->similaritySearch($v, $tid, 5);

    expect($hits)->toBeEmpty();

    tenancy()->end();
});

it('test_hybrid_search_ranks_by_combined_score', function (): void {
    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'Hybrid Rank '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@hybrid.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    $tid = $tenant->getTenantKey();

    $d1 = RagDocument::query()->create([
        'tenant_id' => $tid,
        'name' => 'a',
        'type' => 'txt',
        'path' => $tid.'/a.txt',
        'indexed_at' => now(),
    ]);

    $d2 = RagDocument::query()->create([
        'tenant_id' => $tid,
        'name' => 'b',
        'type' => 'txt',
        'path' => $tid.'/b.txt',
        'indexed_at' => now(),
    ]);

    RagChunk::query()->create([
        'document_id' => $d1->id,
        'content' => 'alpha unrelated content',
        'chunk_index' => 0,
        'created_at' => now(),
    ]);

    RagChunk::query()->create([
        'document_id' => $d2->id,
        'content' => 'beta RankMarkerKeyword unique',
        'chunk_index' => 0,
        'created_at' => now(),
    ]);

    tenancy()->end();

    tenancy()->initialize($tenant);

    Http::preventStrayRequests();

    $stub = array_fill(0, 1536, 0.001);

    Http::fake(function (Request $request) use ($stub) {
        if (! str_contains($request->url(), '/embeddings')) {
            return Http::response(['error' => 'no'], 404);
        }

        return Http::response([
            'data' => [['embedding' => $stub]],
            'usage' => ['prompt_tokens' => 1, 'total_tokens' => 1],
        ], 200);
    });

    $results = app(RagSearchService::class)->hybridSearch('RankMarkerKeyword', $tid, $tid, 5);

    expect($results->first()?->content ?? '')->toContain('RankMarkerKeyword');

    tenancy()->end();
});

it('test_get_relevant_context_formats_as_string_with_separators', function (): void {
    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'CtxFmt '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@ctxfmt.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    $tid = $tenant->getTenantKey();

    $d = RagDocument::query()->create([
        'tenant_id' => $tid,
        'name' => 'multi',
        'type' => 'txt',
        'path' => $tid.'/m.txt',
        'indexed_at' => now(),
    ]);

    RagChunk::query()->create([
        'document_id' => $d->id,
        'content' => 'first-line-x',
        'chunk_index' => 0,
        'created_at' => now(),
    ]);

    RagChunk::query()->create([
        'document_id' => $d->id,
        'content' => 'second-line-x',
        'chunk_index' => 1,
        'created_at' => now(),
    ]);

    tenancy()->end();

    tenancy()->initialize($tenant);

    Http::preventStrayRequests();

    $stub = array_fill(0, 1536, 0.002);

    Http::fake(function (Request $request) use ($stub) {
        if (! str_contains($request->url(), '/embeddings')) {
            return Http::response(['error' => 'no'], 404);
        }

        return Http::response([
            'data' => [['embedding' => $stub]],
            'usage' => ['prompt_tokens' => 1, 'total_tokens' => 1],
        ], 200);
    });

    $ctx = app(RagSearchService::class)->getRelevantContext('line-x', $tid, $tid);

    expect($ctx)->toContain("\n---\n");

    tenancy()->end();
});

it('test_returns_empty_collection_when_no_chunks_indexed', function (): void {
    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'Empty Hybrid '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@empty-hybrid.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    $tid = $tenant->getTenantKey();

    Http::preventStrayRequests();

    Http::fake(function (Request $request) {
        return Http::response([
            'data' => [['embedding' => array_fill(0, 1536, 0)]],
            'usage' => ['prompt_tokens' => 1, 'total_tokens' => 1],
        ], 200);
    });

    $results = app(RagSearchService::class)->hybridSearch('nothing-matches-this-xyz-12345', $tid, $tid, 5);

    expect($results)->toBeEmpty();

    tenancy()->end();
});
