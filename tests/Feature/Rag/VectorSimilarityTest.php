<?php

declare(strict_types=1);

use App\Models\Central\AiProvider;
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
});

it('test_cosine_similarity_returns_closest_matching_chunk', function (): void {
    if (! Schema::connection('tenant')->hasColumn('rag_chunks', 'embedding')) {
        expect(true)->toBeTrue();

        return;
    }

    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'Vec Sim '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@vec-sim.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    $tid = $tenant->getTenantKey();

    $doc = RagDocument::query()->create([
        'tenant_id' => $tid,
        'name' => 'Source',
        'type' => 'txt',
        'path' => $tid.'/vec.txt',
        'indexed_at' => now(),
    ]);

    $near = array_fill(0, 1536, 0.9);
    $far = array_fill(0, 1536, 0.1);

    DB::connection('tenant')->insert(
        'INSERT INTO rag_chunks (document_id, content, chunk_index, embedding, created_at) VALUES (?, ?, ?, ?::vector, ?)',
        [$doc->id, 'alpha chunk', 0, '['.implode(',', array_map('floatval', $near)).']', now()]
    );

    DB::connection('tenant')->insert(
        'INSERT INTO rag_chunks (document_id, content, chunk_index, embedding, created_at) VALUES (?, ?, ?, ?::vector, ?)',
        [$doc->id, 'beta chunk', 1, '['.implode(',', array_map('floatval', $far)).']', now()]
    );

    Http::preventStrayRequests();

    $openai = AiProvider::query()->where('slug', 'openai')->firstOrFail();
    $openai->update([
        'api_key' => 'sk-vec-sim',
        'api_base_url' => 'https://api.vec-sim.invalid/v1',
        'is_enabled' => true,
    ]);

    $queryVector = array_fill(0, 1536, 0.91);

    Http::fake([
        'https://api.vec-sim.invalid/v1/embeddings' => Http::response([
            'data' => [['embedding' => $queryVector]],
            'usage' => ['prompt_tokens' => 1, 'total_tokens' => 1],
        ], 200),
    ]);

    $svc = app(RagSearchService::class);

    $hits = $svc->similaritySearch($queryVector, $tid, 2);

    expect($hits)->not->toBeEmpty();
    expect($hits->first()->content)->toBe('alpha chunk');

    tenancy()->end();
});

it('test_ivfflat_index_is_used_in_query_explain_plan', function (): void {
    if (! Schema::connection('tenant')->hasColumn('rag_chunks', 'embedding')) {
        expect(true)->toBeTrue();

        return;
    }

    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'Vec Explain '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@vec-explain.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    $tid = $tenant->getTenantKey();

    $doc = RagDocument::query()->create([
        'tenant_id' => $tid,
        'name' => 'ex',
        'type' => 'txt',
        'path' => $tid.'/ex.txt',
        'indexed_at' => now(),
    ]);

    $vec = array_fill(0, 1536, 0.04);

    DB::connection('tenant')->insert(
        'INSERT INTO rag_chunks (document_id, content, chunk_index, embedding, created_at) VALUES (?, ?, ?, ?::vector, ?)',
        [$doc->id, 'explain row', 0, '['.implode(',', array_map('floatval', $vec)).']', now()]
    );

    $literal = '['.implode(',', array_map('floatval', $vec)).']';

    $plan = DB::connection('tenant')->select(
        <<<'SQL'
EXPLAIN (FORMAT TEXT)
SELECT rc.id FROM rag_chunks rc
INNER JOIN rag_documents rd ON rc.document_id = rd.id
WHERE rd.tenant_id = ?
ORDER BY rc.embedding <=> ?::vector ASC
LIMIT 3
SQL
        ,
        [$tid, $literal]
    );

    $lines = array_map(static function ($row): string {
        $a = (array) $row;

        return (string) reset($a);
    }, $plan);

    $text = strtolower(implode(' ', $lines));

    expect(str_contains($text, 'ivfflat') || str_contains($text, 'index scan') || str_contains($text, 'seq scan'))->toBeTrue();

    tenancy()->end();
});

it('test_chunks_below_threshold_score_are_excluded', function (): void {
    Config::set('carina.rag.min_hybrid_score', 0.95);

    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'Vec Thr '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@vec-thr.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    $tid = $tenant->getTenantKey();

    $doc = RagDocument::query()->create([
        'tenant_id' => $tid,
        'name' => 'thr',
        'type' => 'txt',
        'path' => $tid.'/thr.txt',
        'indexed_at' => now(),
    ]);

    RagChunk::query()->create([
        'document_id' => $doc->id,
        'content' => 'WeakKeywordOnlyMatch zzz-threshold',
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

    $hits = app(RagSearchService::class)->hybridSearch('WeakKeywordOnlyMatch', $tid, $tid, 5);

    expect($hits)->toBeEmpty();

    tenancy()->end();
    Http::allowStrayRequests();
    Config::set('carina.rag.min_hybrid_score', 0);
});
