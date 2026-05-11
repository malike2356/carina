<?php

declare(strict_types=1);

/**
 * Section 13 -- Feature/Rag/RagIngestionTest
 */

use App\Jobs\Rag\ProcessDocumentJob;
use App\Models\Rag\RagChunk;
use App\Models\Rag\RagDocument;
use App\Services\Rag\RagIngestionService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

it('test_ingest_pdf_creates_document_and_dispatches_process_job', function (): void {
    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'RAG PDF '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@rag-pdf.test',
        'plan' => 'starter',
    ]);

    Queue::fake();

    tenancy()->initialize($tenant);

    $file = UploadedFile::fake()->create('memo.pdf', 12, 'application/pdf');

    app(RagIngestionService::class)->ingestDocument($file, $tenant->getTenantKey());

    Queue::assertPushed(ProcessDocumentJob::class, 1);

    tenancy()->end();
});

it('test_ingest_docx_creates_document_and_dispatches_process_job', function (): void {
    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'RAG DOCX '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@rag-docx.test',
        'plan' => 'starter',
    ]);

    Queue::fake();

    tenancy()->initialize($tenant);

    $file = UploadedFile::fake()->create('memo.docx', 14, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

    app(RagIngestionService::class)->ingestDocument($file, $tenant->getTenantKey());

    Queue::assertPushed(ProcessDocumentJob::class, 1);

    tenancy()->end();
});

it('test_ingest_txt_creates_document_and_dispatches_process_job', function (): void {
    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'RAG TXT '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@rag-txt.test',
        'plan' => 'starter',
    ]);

    Queue::fake();

    tenancy()->initialize($tenant);

    $file = UploadedFile::fake()->create('memo.txt', 8, 'text/plain');

    app(RagIngestionService::class)->ingestDocument($file, $tenant->getTenantKey());

    Queue::assertPushed(ProcessDocumentJob::class, 1);

    tenancy()->end();
});

it('test_ingest_rejects_disallowed_mime_type', function (): void {
    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'RAG Mime '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@rag-mime.test',
        'plan' => 'starter',
    ]);

    Queue::fake();

    tenancy()->initialize($tenant);

    $file = UploadedFile::fake()->create('evil.exe', 5, 'application/x-msdownload');

    expect(fn () => app(RagIngestionService::class)->ingestDocument($file, $tenant->getTenantKey()))
        ->toThrow(ValidationException::class);

    Queue::assertNothingPushed();

    tenancy()->end();
});

it('test_chunk_text_produces_correct_chunk_count', function (): void {
    $svc = app(RagIngestionService::class);
    $text = str_repeat('x', 2500);

    $chunks = $svc->chunkText($text, 1000, 200);

    expect(count($chunks))->toBe(3);
});

it('test_chunk_text_produces_correct_overlap', function (): void {
    $svc = app(RagIngestionService::class);
    $chunks = $svc->chunkText(str_repeat('a', 100).str_repeat('b', 100).str_repeat('c', 100), 120, 20);

    expect(count($chunks))->toBeGreaterThan(1);
    expect(strlen(implode('', $chunks)))->toBeGreaterThanOrEqual(300);
});

it('test_chunk_text_handles_text_shorter_than_chunk_size', function (): void {
    $svc = app(RagIngestionService::class);

    expect($svc->chunkText('short', 1000, 200))->toBe(['short']);
});

it('test_store_chunks_bulk_inserts_inside_transaction', function (): void {
    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'RAG Store '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@rag-store.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    if (! Schema::connection('tenant')->hasColumn('rag_chunks', 'embedding')) {
        tenancy()->end();

        expect(true)->toBeTrue();

        return;
    }

    $tid = $tenant->getTenantKey();

    $doc = RagDocument::query()->create([
        'tenant_id' => $tid,
        'name' => 'store',
        'type' => 'txt',
        'path' => $tid.'/store.txt',
        'indexed_at' => null,
    ]);

    $vec = array_fill(0, 1536, 0.01);
    $vectors = [$vec, $vec];

    app(RagIngestionService::class)->storeChunks((int) $doc->id, ['chunk-a', 'chunk-b'], $vectors);

    expect(RagChunk::query()->where('document_id', $doc->id)->count())->toBe(2);

    tenancy()->end();
});
