<?php

declare(strict_types=1);

use App\Models\Central\AiProvider;
use App\Models\Central\FeatureFlag;
use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\CarinaConversationDocument;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaDocumentReadService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

beforeEach(function (): void {
    FeatureFlag::syncFromCatalogue();
    Storage::fake('local');
});

afterEach(function (): void {
    Http::allowStrayRequests();
    Config::set('carina.document_read.max_chars', 50000);
    Config::set('carina_security.upload.max_size_mb', 20);
});

function carinaDocumentTenantHost(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Carina Docs '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@carina-docs.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    return [$tenant, $host, $user];
}

it('uploads a csv document and returns preview metadata', function (): void {
    [$tenant, $host, $user] = carinaDocumentTenantHost();

    tenancy()->initialize($tenant);
    $conversation = CarinaConversation::query()->create([
        'tenant_id' => $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Doc thread',
    ]);
    tenancy()->end();

    $csv = "Name,Amount\nAlice,100\nBob,200\n";
    $file = UploadedFile::fake()->createWithContent('portfolio.csv', $csv, 'text/csv');

    $this->actingAs($user, 'web')
        ->postJson('http://'.$host.'/api/carina/conversations/'.$conversation->id.'/documents', [
            'file' => $file,
        ])
        ->assertOk()
        ->assertJsonPath('filename', 'portfolio.csv')
        ->assertJsonPath('type', 'csv')
        ->assertJsonPath('row_count', 2)
        ->assertJsonStructure(['document_id', 'preview', 'token_count', 'truncated']);

    tenancy()->initialize($tenant);
    expect(CarinaConversationDocument::query()->count())->toBe(1);
    tenancy()->end();
});

it('uploads an xlsx document with sheet and row counts', function (): void {
    [$tenant, $host, $user] = carinaDocumentTenantHost();

    tenancy()->initialize($tenant);
    $conversation = CarinaConversation::query()->create([
        'tenant_id' => $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Spreadsheet thread',
    ]);
    tenancy()->end();

    $tmp = tempnam(sys_get_temp_dir(), 'carina-xlsx-');
    $spreadsheet = new Spreadsheet;
    $sheet = $spreadsheet->getActiveSheet();
    $sheet->setTitle('Sheet1');
    $sheet->fromArray([
        ['Header1', 'Header2'],
        ['val1', 'val2'],
        ['val3', 'val4'],
    ]);
    (new Xlsx($spreadsheet))->save($tmp);

    $file = new UploadedFile(
        $tmp,
        'deal-sheet.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        null,
        true,
    );

    $this->actingAs($user, 'web')
        ->postJson('http://'.$host.'/api/carina/conversations/'.$conversation->id.'/documents', [
            'file' => $file,
        ])
        ->assertOk()
        ->assertJsonPath('type', 'xlsx')
        ->assertJsonPath('sheet_count', 1)
        ->assertJsonPath('row_count', 2);

    @unlink($tmp);
});

it('returns the same document id for duplicate uploads in one conversation', function (): void {
    [$tenant, $host, $user] = carinaDocumentTenantHost();

    tenancy()->initialize($tenant);
    $conversation = CarinaConversation::query()->create([
        'tenant_id' => $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Duplicate thread',
    ]);
    tenancy()->end();

    $file = UploadedFile::fake()->createWithContent('notes.txt', 'Same content every time.', 'text/plain');

    $first = $this->actingAs($user, 'web')
        ->postJson('http://'.$host.'/api/carina/conversations/'.$conversation->id.'/documents', [
            'file' => $file,
        ])
        ->assertOk()
        ->json('document_id');

    $second = $this->actingAs($user, 'web')
        ->postJson('http://'.$host.'/api/carina/conversations/'.$conversation->id.'/documents', [
            'file' => UploadedFile::fake()->createWithContent('notes-copy.txt', 'Same content every time.', 'text/plain'),
        ])
        ->assertOk()
        ->json('document_id');

    expect($second)->toBe($first);

    tenancy()->initialize($tenant);
    expect(CarinaConversationDocument::query()->count())->toBe(1);
    tenancy()->end();
});

it('truncates extracted text when max_chars is exceeded', function (): void {
    Config::set('carina.document_read.max_chars', 20);

    $service = app(CarinaDocumentReadService::class);
    $path = storage_path('app/testing-long.txt');
    file_put_contents($path, str_repeat('A', 100));

  $result = $service->extractFromPath($path, 'txt', 'long.txt');

    expect($result->truncated)->toBeTrue();
    expect($result->extractedText)->toContain('[...truncated at 20 characters');

    @unlink($path);
});

it('rejects unsupported mime types with 422', function (): void {
    [$tenant, $host, $user] = carinaDocumentTenantHost();

    tenancy()->initialize($tenant);
    $conversation = CarinaConversation::query()->create([
        'tenant_id' => $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Reject thread',
    ]);
    tenancy()->end();

    $file = UploadedFile::fake()->create('malware.exe', 10, 'application/x-msdownload');

    $this->actingAs($user, 'web')
        ->postJson('http://'.$host.'/api/carina/conversations/'.$conversation->id.'/documents', [
            'file' => $file,
        ])
        ->assertStatus(422);
});

it('rejects files that exceed the upload size limit', function (): void {
    Config::set('carina_security.upload.max_size_mb', 1);

    [$tenant, $host, $user] = carinaDocumentTenantHost();

    tenancy()->initialize($tenant);
    $conversation = CarinaConversation::query()->create([
        'tenant_id' => $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Large file thread',
    ]);
    tenancy()->end();

    $file = UploadedFile::fake()->create('large.pdf', 2048, 'application/pdf');

    $this->actingAs($user, 'web')
        ->postJson('http://'.$host.'/api/carina/conversations/'.$conversation->id.'/documents', [
            'file' => $file,
        ])
        ->assertStatus(422)
        ->assertJsonFragment(['message' => 'File exceeds the maximum allowed size of 1 MB.']);
});

it('injects attached document context into carina chat requests', function (): void {
    Http::preventStrayRequests();

    $groq = AiProvider::query()->where('slug', 'groq')->firstOrFail();
    $groq->update([
        'api_key' => 'gsk-test-key',
        'api_base_url' => 'https://api.carina-docs.invalid/openai/v1',
        'is_enabled' => true,
    ]);

    Http::fake([
        'https://api.carina-docs.invalid/openai/v1/chat/completions' => function ($request) {
            $body = json_decode($request->body(), true, 512, JSON_THROW_ON_ERROR);
            $userContent = collect($body['messages'] ?? [])
                ->where('role', 'user')
                ->last()['content'] ?? '';

            expect($userContent)->toContain('[ATTACHED DOCUMENT]');
            expect($userContent)->toContain('Rent roll summary');

            return Http::response([
                'choices' => [['message' => ['content' => 'I see the rent roll.']]],
                'usage' => ['prompt_tokens' => 5, 'completion_tokens' => 7],
            ], 200);
        },
    ]);

    [$tenant, $host, $user] = carinaDocumentTenantHost();

    tenancy()->initialize($tenant);
    $conversation = CarinaConversation::query()->create([
        'tenant_id' => $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Context thread',
    ]);

    CarinaConversationDocument::query()->create([
        'carina_conversation_id' => $conversation->id,
        'tenant_id' => $tenant->getTenantKey(),
        'user_id' => $user->id,
        'original_filename' => 'rent-roll.txt',
        'storage_path' => 'carina-uploads/'.$tenant->getTenantKey().'/rent-roll.txt',
        'file_type' => 'txt',
        'file_size_bytes' => 32,
        'extracted_text_preview' => 'Rent roll summary',
        'token_count' => 8,
        'metadata' => [],
    ]);

    Storage::disk('local')->put(
        'carina-uploads/'.$tenant->getTenantKey().'/rent-roll.txt',
        'Rent roll summary with tenant names.',
    );
    Storage::disk('local')->put(
        'carina-uploads/'.$tenant->getTenantKey().'/rent-roll.extracted.txt',
        'Rent roll summary with tenant names.',
    );
    tenancy()->end();

    $this->actingAs($user, 'web')
        ->postJson('http://'.$host.'/api/carina/chat', [
            'conversation_id' => $conversation->id,
            'message' => 'What does the file say?',
        ])
        ->assertOk()
        ->assertJsonPath('message', 'I see the rent roll.');
});

it('cleans up old conversation documents and stored files', function (): void {
    [$tenant, ,] = carinaDocumentTenantHost();

    tenancy()->initialize($tenant);

    $doc = CarinaConversationDocument::query()->create([
        'carina_conversation_id' => CarinaConversation::query()->create([
            'tenant_id' => $tenant->getTenantKey(),
            'user_id' => User::query()->firstOrFail()->id,
            'title' => 'Old doc thread',
        ])->id,
        'tenant_id' => $tenant->getTenantKey(),
        'user_id' => User::query()->firstOrFail()->id,
        'original_filename' => 'old.txt',
        'storage_path' => 'carina-uploads/'.$tenant->getTenantKey().'/old.txt',
        'file_type' => 'txt',
        'file_size_bytes' => 12,
        'extracted_text_preview' => 'old data',
        'token_count' => 3,
        'metadata' => [],
        'created_at' => now()->subHours(72),
        'updated_at' => now()->subHours(72),
    ]);

    Storage::disk('local')->put($doc->storage_path, 'old data');
    Storage::disk('local')->put(
        app(CarinaDocumentReadService::class)->extractedTextStoragePath($doc->storage_path),
        'old data',
    );

    tenancy()->end();

    Artisan::call('carina:clean-uploads');

    tenancy()->initialize($tenant);
    expect(CarinaConversationDocument::query()->count())->toBe(0);
    expect(Storage::disk('local')->exists($doc->storage_path))->toBeFalse();
    tenancy()->end();
});
