<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\ComplianceItem;
use App\Models\Tenant\Document;
use App\Models\Tenant\Property;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('stores a new file version and lists both in history', function (): void {
    Http::preventStrayRequests();
    Storage::fake('local');

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Vault ver '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@vault-ver.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'document_vault')->update(['enabled' => true]);
    completeTenantWorkspaceOnboarding();
    $user = User::query()->firstOrFail();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->post('http://'.$host.'/documents', [
        'title' => 'Gas cert',
        'category' => 'compliance_evidence',
        'file' => UploadedFile::fake()->create('v1.pdf', 100, 'application/pdf'),
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $v1 = Document::query()->latest('id')->firstOrFail();
    expect($v1->version)->toBe(1);
    expect((int) $v1->root_document_id)->toBe((int) $v1->id);
    tenancy()->end();

    $this->post('http://'.$host.'/documents', [
        'previous_document_id' => $v1->id,
        'file' => UploadedFile::fake()->create('v2.pdf', 100, 'application/pdf'),
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $v2 = Document::query()->latest('id')->firstOrFail();
    expect($v2->version)->toBe(2);
    expect((int) $v2->root_document_id)->toBe((int) $v1->root_document_id);
    tenancy()->end();

    $this->get('http://'.$host.'/documents/'.$v2->id.'/versions')
        ->assertOk()
        ->assertSee('Gas cert', false)
        ->assertSee('v1', false)
        ->assertSee('v2', false);
});

it('links workspace document to compliance item on upload', function (): void {
    Http::preventStrayRequests();
    Storage::fake('local');

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Vault comp '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@vault-comp.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'document_vault')->update(['enabled' => true]);
    completeTenantWorkspaceOnboarding();
    $user = User::query()->firstOrFail();

    $property = Property::query()->create([
        'address_line1' => '1 Test Row',
        'city' => 'Leeds',
        'postcode' => 'LS11AA',
        'property_type' => 'flat',
        'status' => 'managing',
        'created_by' => $user->id,
    ]);

    $item = ComplianceItem::query()->create([
        'property_id' => $property->id,
        'created_by' => $user->id,
        'category' => 'safety',
        'type' => 'gas_safety',
        'title' => 'Gas safety CP12',
        'status' => 'valid',
        'reminder_days' => 30,
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->post('http://'.$host.'/documents', [
        'title' => 'CP12 scan',
        'category' => 'compliance_evidence',
        'compliance_item_id' => $item->id,
        'property_id' => $property->id,
        'file' => UploadedFile::fake()->create('cp12.pdf', 100, 'application/pdf'),
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $doc = Document::query()->latest('id')->firstOrFail();
    expect($doc->compliance_item_id)->toBe($item->id);
    expect($doc->property_id)->toBe($property->id);
    tenancy()->end();
});
