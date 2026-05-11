<?php

declare(strict_types=1);

use App\Models\Tenant\Property;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Http\UploadedFile;

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('uploads a vault document and shows it on the property page', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Vault UI '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@vault-ui.test',
        'plan' => 'mentor_network',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = Property::query()->create([
        'address_line1' => '9 Vault Street',
        'city' => 'Leeds',
        'postcode' => 'LS1 1AA',
        'property_type' => 'flat',
        'status' => 'owned',
        'strategy' => 'btl',
        'created_by' => $user->id,
    ]);

    tenancy()->end();

    $this->actingAs($user, 'web');
    $base = 'http://'.$host;

    $file = UploadedFile::fake()->create('title-deed.pdf', 120, 'application/pdf');

    $this->post($base.'/properties/'.$property->id.'/documents', [
        'file' => $file,
        'name' => 'Title deed',
    ])->assertRedirect($base.'/properties/'.$property->id);

    $this->get($base.'/properties/'.$property->id)
        ->assertOk()
        ->assertSee('Document vault')
        ->assertSee('Title deed')
        ->assertSee('v1');
});
