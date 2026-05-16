<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\DealAnalysis;
use App\Models\Tenant\Document;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'document_vault')->update(['enabled' => true]);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('can edit document metadata', function (): void {
    Http::preventStrayRequests();
    Storage::fake('local');

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Doc edit '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@doc-edit.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    completeTenantWorkspaceOnboarding();
    $user = User::query()->firstOrFail();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->post('http://'.$host.'/documents', [
        'title' => 'Original title',
        'category' => 'other',
        'file' => UploadedFile::fake()->create('doc.pdf', 200, 'application/pdf'),
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $doc = Document::query()->latest('id')->firstOrFail();
    $id = (int) $doc->getKey();
    tenancy()->end();

    $this->put('http://'.$host.'/documents/'.$id, [
        'title' => 'Updated title',
        'category' => 'survey',
        'notes' => 'Updated notes line',
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $doc->refresh();
    expect($doc->title)->toBe('Updated title');
    expect($doc->category)->toBe('survey');
    expect($doc->notes)->toBe('Updated notes line');
    tenancy()->end();
});

it('deal show page renders documents for linked deal', function (): void {
    Http::preventStrayRequests();
    Storage::fake('local');

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Deal docs '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@deal-docs.test',
        'plan' => 'mentor_network',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::query()->where('key', 'deal_engine')->update(['enabled' => true, 'tenant_overrides' => null]);
    FeatureFlag::query()->where('key', 'document_vault')->update(['enabled' => true]);
    completeTenantWorkspaceOnboarding();
    $user = User::query()->firstOrFail();

    $deal = DealAnalysis::query()->create([
        'property_id' => null,
        'created_by' => $user->id,
        'strategy' => 'btl',
        'title' => 'Linked deal',
        'metrics' => [],
        'status' => 'draft',
    ]);

    Document::query()->create([
        'created_by' => $user->id,
        'deal_analysis_id' => $deal->id,
        'title' => 'First attachment',
        'category' => 'other',
        'file_path' => 'documents/test/a.pdf',
        'original_filename' => 'a.pdf',
        'mime_type' => 'application/pdf',
        'size_bytes' => 100,
    ]);
    Document::query()->create([
        'created_by' => $user->id,
        'deal_analysis_id' => $deal->id,
        'title' => 'Second attachment',
        'category' => 'survey',
        'file_path' => 'documents/test/b.pdf',
        'original_filename' => 'b.pdf',
        'mime_type' => 'application/pdf',
        'size_bytes' => 200,
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/deals/'.$deal->id)
        ->assertOk()
        ->assertSee('First attachment')
        ->assertSee('Second attachment');
});
