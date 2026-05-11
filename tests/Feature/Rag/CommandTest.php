<?php

declare(strict_types=1);

/**
 * Section 13 -- Feature/Rag/CommandTest
 */

use App\Jobs\Rag\ProcessDocumentJob;
use App\Models\Rag\RagDocument;
use App\Models\Rag\RagSource;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

it('test_rag_index_pending_dispatches_job_per_pending_document', function (): void {
    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'RAG Cmd Idx '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@rag-cmd-idx.test',
        'plan' => 'starter',
    ]);

    Queue::fake();

    tenancy()->initialize($tenant);

    RagDocument::query()->create([
        'tenant_id' => $tenant->getTenantKey(),
        'name' => 'Pending',
        'type' => 'txt',
        'path' => $tenant->getTenantKey().'/pending.txt',
        'indexed_at' => null,
    ]);

    tenancy()->end();

    Artisan::call('rag:index-pending', ['--tenant' => $tenant->id]);

    Queue::assertPushed(ProcessDocumentJob::class, 1);
});

it('test_rag_index_pending_scopes_to_tenant_when_option_provided', function (): void {
    $tenantSvc = app(TenantCreationService::class);

    $keeper = $tenantSvc->createTenant([
        'company_name' => 'Keep '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@keep.test',
        'plan' => 'starter',
    ]);

    $noise = $tenantSvc->createTenant([
        'company_name' => 'Noise '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@noise.test',
        'plan' => 'starter',
    ]);

    Queue::fake();

    tenancy()->initialize($noise);
    RagDocument::query()->create([
        'tenant_id' => $noise->getTenantKey(),
        'name' => 'Noise pending',
        'type' => 'txt',
        'path' => $noise->getTenantKey().'/noise.txt',
        'indexed_at' => null,
    ]);
    tenancy()->end();

    tenancy()->initialize($keeper);
    RagDocument::query()->create([
        'tenant_id' => $keeper->getTenantKey(),
        'name' => 'Keeper pending',
        'type' => 'txt',
        'path' => $keeper->getTenantKey().'/keep.txt',
        'indexed_at' => null,
    ]);
    tenancy()->end();

    Artisan::call('rag:index-pending', ['--tenant' => $keeper->id]);

    Queue::assertPushed(ProcessDocumentJob::class, 1);
});

it('test_rag_index_pending_dispatches_across_all_tenants_when_no_option', function (): void {
    $tenantSvc = app(TenantCreationService::class);

    foreach (['Alpha', 'Beta'] as $label) {
        $tenant = $tenantSvc->createTenant([
            'company_name' => $label.' '.uniqid(),
            'owner_name' => 'Owner',
            'owner_email' => strtolower($label).'-'.uniqid().'@multi-idx.test',
            'plan' => 'starter',
        ]);

        tenancy()->initialize($tenant);
        RagDocument::query()->create([
            'tenant_id' => $tenant->getTenantKey(),
            'name' => 'Doc '.$label,
            'type' => 'txt',
            'path' => $tenant->getTenantKey().'/'.$label.'.txt',
            'indexed_at' => null,
        ]);
        tenancy()->end();
    }

    Queue::fake();

    Artisan::call('rag:index-pending');

    $count = 0;
    Queue::assertPushed(ProcessDocumentJob::class, function () use (&$count): bool {
        $count++;

        return true;
    });

    expect($count)->toBeGreaterThanOrEqual(2);
});

it('test_rag_reindex_resets_indexed_at_and_dispatches_job', function (): void {
    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'RAG Cmd Re '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@rag-cmd-re.test',
        'plan' => 'starter',
    ]);

    Queue::fake();

    tenancy()->initialize($tenant);

    $doc = RagDocument::query()->create([
        'tenant_id' => $tenant->getTenantKey(),
        'name' => 'Indexed',
        'type' => 'txt',
        'path' => $tenant->getTenantKey().'/idx.txt',
        'indexed_at' => now(),
    ]);

    Artisan::call('rag:reindex', ['documentId' => $doc->id]);

    $doc->refresh();

    expect($doc->indexed_at)->toBeNull();

    Queue::assertPushed(ProcessDocumentJob::class, 1);

    tenancy()->end();
});

it('test_rag_reindex_outputs_error_for_unknown_document_id', function (): void {
    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'RAG Cmd Missing '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@rag-cmd-missing.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    $code = Artisan::call('rag:reindex', ['documentId' => 999_999_999]);

    expect($code)->not->toBe(0);

    tenancy()->end();
});

it('ingests a limited set of brain knowledge markdown and dispatches process jobs', function (): void {
    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'RAG Brain '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@rag-brain.test',
        'plan' => 'starter',
    ]);

    Queue::fake();

    $exitCode = Artisan::call('rag:ingest-brain-knowledge', [
        '--tenant' => $tenant->id,
        '--limit' => '2',
    ]);

    expect($exitCode)->toBe(0);

    Queue::assertPushed(ProcessDocumentJob::class, 2);

    tenancy()->initialize($tenant);

    $count = RagDocument::query()
        ->where('tenant_id', $tenant->getTenantKey())
        ->where('metadata->source', 'brain_knowledge')
        ->count();

    expect($count)->toBe(2);

    tenancy()->end();
});

it('creates a starter rag document and dispatches process job', function (): void {
    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'RAG Starter '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@rag-starter.test',
        'plan' => 'starter',
    ]);

    Queue::fake();

    $exitCode = Artisan::call('rag:create-starter-document', ['--tenant' => $tenant->id]);

    expect($exitCode)->toBe(0);

    Queue::assertPushed(ProcessDocumentJob::class, 1);

    tenancy()->initialize($tenant);

    $doc = RagDocument::query()->where('name', 'carina-rag-starter.md')->first();

    expect($doc)->not->toBeNull();
    expect($doc->indexed_at)->toBeNull();
    expect(Storage::disk('local')->exists('rag/'.$doc->path))->toBeTrue();

    tenancy()->end();
});

it('test_rag_sync_updates_last_synced_at_on_each_source', function (): void {
    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'RAG Cmd Sync '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@rag-cmd-sync.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    $source = RagSource::query()->create([
        'name' => 'Drive',
        'type' => 'google_drive',
        'is_active' => true,
        'last_synced_at' => null,
    ]);

    tenancy()->end();

    Artisan::call('rag:sync', ['--source' => (string) $source->id]);

    tenancy()->initialize($tenant);

    $source->refresh();

    expect($source->last_synced_at)->not->toBeNull();

    tenancy()->end();
});
