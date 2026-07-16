<?php

declare(strict_types=1);

use App\Models\Tenant\Property;
use App\Models\Tenant\PropertyTenancy;
use App\Models\Tenant\TenancyDocument;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    $this->seed(FeatureFlagSeeder::class);
    $this->withoutMiddleware(VerifyCsrfToken::class);
    Storage::fake('local');
});

it('shows tenant dossier sections on the tenancy detail page', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Dossier UI '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@dossier.test',
        'plan' => 'mentor_network',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = Property::query()->create([
        'address_line1' => '1 Dossier Lane',
        'city' => 'Portsmouth',
        'postcode' => 'PO1 1AA',
        'property_type' => 'flat',
        'status' => 'managing',
        'strategy' => 'btl',
        'created_by' => $user->id,
    ]);

    $tenancy = PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'Jordan Lee',
        'legal_name' => 'Jordan Alexander Lee',
        'rent_amount' => 1100,
        'start_date' => '2024-01-01',
        'right_to_rent_status' => 'pass',
        'agreement_status' => 'signed',
        'agreement_signed_at' => '2024-01-05',
    ]);

    tenancy()->end();

    $this->actingAs($user, 'web')
        ->get('http://'.$host.'/properties/tenancies/'.$tenancy->id)
        ->assertOk()
        ->assertSee('Tenant dossier')
        ->assertSee('Jordan Alexander Lee')
        ->assertSee('ID &amp; right to rent', false)
        ->assertSee('Tenant pack (PDF)')
        ->assertSee('Right to rent confirmed');
});

it('updates dossier profile and identity fields', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Dossier Upd '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@dossier-upd.test',
        'plan' => 'mentor_network',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = Property::query()->create([
        'address_line1' => '2 Update Street',
        'city' => 'Portsmouth',
        'postcode' => 'PO2 2BB',
        'property_type' => 'flat',
        'status' => 'managing',
        'strategy' => 'btl',
        'created_by' => $user->id,
    ]);

    $tenancy = PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'Sam Tenant',
        'rent_amount' => 900,
        'start_date' => '2025-01-01',
    ]);

    tenancy()->end();

    $this->actingAs($user, 'web');
    $base = 'http://'.$host;
    $url = $base.'/properties/'.$property->id.'/tenancies/'.$tenancy->id;

    $this->put($url.'/dossier', [
        'section' => 'identity',
        'id_type' => 'passport',
        'id_reference' => '123456789',
        'right_to_rent_status' => 'pass',
        'right_to_rent_check_date' => '2025-01-02',
    ])->assertRedirect($base.'/properties/tenancies/'.$tenancy->id);

    tenancy()->initialize($tenant);
    $tenancy->refresh();
    expect($tenancy->id_type)->toBe('passport')
        ->and($tenancy->id_reference)->toBe('123456789')
        ->and($tenancy->right_to_rent_status)->toBe('pass');
    tenancy()->end();
});

it('uploads a tenancy document and exports tenant pack pdf', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Dossier Doc '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@dossier-doc.test',
        'plan' => 'mentor_network',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = Property::query()->create([
        'address_line1' => '3 Doc Road',
        'city' => 'Portsmouth',
        'postcode' => 'PO3 3CC',
        'property_type' => 'flat',
        'status' => 'managing',
        'strategy' => 'btl',
        'created_by' => $user->id,
    ]);

    $tenancy = PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'Casey File',
        'rent_amount' => 850,
        'start_date' => '2025-03-01',
        'agreement_status' => 'signed',
    ]);

    tenancy()->end();

    $this->actingAs($user, 'web');
    $base = 'http://'.$host;

    $this->post($base.'/properties/'.$property->id.'/tenancies/'.$tenancy->id.'/documents', [
        'category' => TenancyDocument::CATEGORY_AST,
        'name' => 'Signed AST 2025',
        'served_at' => '2025-03-01',
        'file' => UploadedFile::fake()->create('ast.pdf', 100, 'application/pdf'),
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    expect(TenancyDocument::query()->where('property_tenancy_id', $tenancy->id)->count())->toBe(1);
    tenancy()->end();

    $this->get($base.'/properties/tenancies/'.$tenancy->id.'/pack')
        ->assertOk()
        ->assertHeader('content-type', 'application/pdf');
});
