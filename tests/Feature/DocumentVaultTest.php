<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\Document;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

function documentVaultTenant(): array
{
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'DocVault '.uniqid(),
        'owner_name' => 'Vault Owner',
        'owner_email' => 'vault-'.uniqid().'@docvault.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->slug.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'document_vault')->update(['enabled' => true]);
    completeTenantWorkspaceOnboarding();
    $user = User::query()->firstOrFail();
    tenancy()->end();

    return [$tenant, $host, $user];
}

it('authenticated user can upload a document', function (): void {
    Http::preventStrayRequests();
    Storage::fake('local');

    [$tenant, $host, $user] = documentVaultTenant();

    $this->actingAs($user, 'web');

    $response = $this->post('http://'.$host.'/documents', [
        'title' => 'Test Title Register',
        'category' => 'title_register',
        'file' => UploadedFile::fake()->create('title-register.pdf', 200, 'application/pdf'),
    ]);

    $response->assertRedirect();

    tenancy()->initialize($tenant);
    $document = Document::query()->latest('id')->first();
    expect($document)->not->toBeNull();
    expect($document->title)->toBe('Test Title Register');
    expect($document->category)->toBe('title_register');
    tenancy()->end();
});

it('uploaded document appears in the index', function (): void {
    Http::preventStrayRequests();
    Storage::fake('local');

    [$tenant, $host, $user] = documentVaultTenant();

    tenancy()->initialize($tenant);
    Document::query()->create([
        'created_by' => $user->getKey(),
        'title' => 'Survey Report',
        'category' => 'survey',
        'file_path' => 'documents/test/fakefile.pdf',
        'original_filename' => 'survey-report.pdf',
        'mime_type' => 'application/pdf',
        'size_bytes' => 512000,
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/documents')
        ->assertOk()
        ->assertSee('Survey Report');
});

it('document can be deleted', function (): void {
    Http::preventStrayRequests();
    Storage::fake('local');

    [$tenant, $host, $user] = documentVaultTenant();

    tenancy()->initialize($tenant);
    $document = Document::query()->create([
        'created_by' => $user->getKey(),
        'title' => 'To Be Deleted',
        'category' => 'other',
        'file_path' => 'documents/test/deleteme.pdf',
        'original_filename' => 'deleteme.pdf',
        'mime_type' => 'application/pdf',
        'size_bytes' => 1024,
    ]);
    $docId = (int) $document->getKey();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->delete('http://'.$host.'/documents/'.$docId)
        ->assertRedirect(route('tenant.documents.index'));

    tenancy()->initialize($tenant);
    expect(Document::query()->find($docId))->toBeNull();
    tenancy()->end();
});
