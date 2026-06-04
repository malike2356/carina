<?php

declare(strict_types=1);

/**
 * Section 15 - Incognito mode (session flag, metadata, blocked learning writes).
 */

use App\Models\Central\AiProvider;
use App\Models\Central\FeatureFlag;
use App\Models\Rag\RagDocument;
use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\User;
use App\Services\Carina\BookkeepingService;
use App\Services\Carina\CarinaIncognitoService;
use App\Services\Carina\CarinaService;
use App\Services\Carina\RAGService;
use App\Services\Rag\RagIngestionService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

beforeEach(function (): void {
    FeatureFlag::syncFromCatalogue();
});

afterEach(function (): void {
    Http::allowStrayRequests();
});

it('detects activation phrases case insensitively', function (): void {
    session()->flush();

    app(CarinaIncognitoService::class)->applyPhrasesFromMessage('Please use PRIVATE MODE for this reply');

    expect(session(CarinaIncognitoService::SESSION_KEY))->toBeTrue();
});

it('detects deactivation phrases', function (): void {
    session([CarinaIncognitoService::SESSION_KEY => true]);

    app(CarinaIncognitoService::class)->applyPhrasesFromMessage('Resume learning now');

    expect(session(CarinaIncognitoService::SESSION_KEY))->toBeFalse();
});

it('deactivation wins when phrase appears in same message before activation', function (): void {
    session()->flush();

    app(CarinaIncognitoService::class)->applyPhrasesFromMessage('Incognito mode off then private mode');

    expect(session(CarinaIncognitoService::SESSION_KEY))->toBeFalse();
});

it('chat api sets metadata incognito and response headers when activating', function (): void {
    Http::preventStrayRequests();

    $groq = AiProvider::query()->where('slug', 'groq')->firstOrFail();
    $groq->update([
        'api_key' => 'gsk-incog-meta',
        'api_base_url' => 'https://api.carina-incog.invalid/openai/v1',
        'is_enabled' => true,
    ]);

    Http::fake([
        'https://api.carina-incog.invalid/openai/v1/chat/completions' => Http::response([
            'choices' => [['message' => ['content' => 'Ack']]],
            'usage' => ['prompt_tokens' => 1, 'completion_tokens' => 1],
        ], 200),
    ]);

    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'Incog Meta '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@incog-meta.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $response = $this->postJson('http://'.$host.'/api/carina/chat', [
        'message' => 'Go incognito',
    ]);

    $response->assertOk()
        ->assertHeader('X-Carina-Incognito', '1');

    expect($response->json('incognito'))->toBeTrue();

    tenancy()->initialize($tenant);

    $conv = CarinaConversation::query()->latest('id')->first();
    expect($conv)->not->toBeNull()
        ->and($conv->metadata['incognito'] ?? null)->toBeTrue();

    tenancy()->end();
});

it('learn_from_correction skips masterbrain write when incognito', function (): void {
    session([CarinaIncognitoService::SESSION_KEY => true]);

    $tenantId = 'test-tenant-'.uniqid();

    $path = (string) config('paths.brain.masterbrain')."/accounting/{$tenantId}/rules.json";
    if (File::exists($path)) {
        File::delete($path);
    }

    app(BookkeepingService::class)->learnFromCorrection('coffee', 'meals', $tenantId);

    expect(File::exists($path))->toBeFalse();
});

it('embed_document skips indexing when incognito session', function (): void {
    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'RAG Incog '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@rag-incog.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    $tid = $tenant->getTenantKey();
    $relative = $tid.'/blocked.txt';

    Storage::disk('local')->makeDirectory('rag/'.$tid);
    Storage::disk('local')->put('rag/'.$relative, 'hello world body');

    $doc = RagDocument::query()->create([
        'tenant_id' => $tid,
        'name' => 'blocked.txt',
        'type' => 'txt',
        'path' => $relative,
        'indexed_at' => null,
    ]);

    session([CarinaIncognitoService::SESSION_KEY => true]);

    app(RAGService::class)->embedDocument($doc->id, $tid);

    $doc->refresh();

    expect($doc->indexed_at)->toBeNull();

    tenancy()->end();
});

it('ingest_document skips process job when incognito', function (): void {
    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'RAG Skip Job '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@rag-skip.test',
        'plan' => 'starter',
    ]);

    Queue::fake();

    session([CarinaIncognitoService::SESSION_KEY => true]);

    tenancy()->initialize($tenant);

    $file = UploadedFile::fake()->create('memo.pdf', 12, 'application/pdf');

    app(RagIngestionService::class)->ingestDocument($file, $tenant->getTenantKey());

    Queue::assertNothingPushed();

    tenancy()->end();
});

it('prepends incognito reminder once per session', function (): void {
    Http::preventStrayRequests();

    $groq = AiProvider::query()->where('slug', 'groq')->firstOrFail();
    $groq->update([
        'api_key' => 'gsk-reminder',
        'api_base_url' => 'https://api.carina-reminder.invalid/openai/v1',
        'is_enabled' => true,
    ]);

    Http::fake([
        'https://api.carina-reminder.invalid/openai/v1/chat/completions' => Http::response([
            'choices' => [['message' => ['content' => 'Ok']]],
            'usage' => ['prompt_tokens' => 2, 'completion_tokens' => 2],
        ], 200),
    ]);

    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'Reminder '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@reminder.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $conv = CarinaConversation::query()->create([
        'tenant_id' => $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Reminder thread',
    ]);

    tenancy()->end();

    session()->flush();
    $this->actingAs($user, 'web');

    $service = app(CarinaService::class);

    tenancy()->initialize($tenant);

    $first = $service->chat($conv, 'Ethical mode');
    $second = $service->chat($conv, 'Say hi');

    tenancy()->end();

    $recorded = Http::recorded();
    expect($recorded)->toHaveCount(2);

    $firstBody = (string) $recorded[0][0]->body();
    $secondBody = (string) $recorded[1][0]->body();

    expect($firstBody)->toContain('REMINDER:')
        ->and($firstBody)->toContain('incognito mode');
    expect($secondBody)->not->toContain('REMINDER:');
});
