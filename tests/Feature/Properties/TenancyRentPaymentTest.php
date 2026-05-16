<?php

declare(strict_types=1);

use App\Models\Tenant\Property;
use App\Models\Tenant\PropertyTenancy;
use App\Models\Tenant\TenancyRentPayment;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('can log a rent payment against a tenancy', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Rent log '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@rent-log.test',
        'plan' => 'mentor_network',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = Property::query()->create([
        'address_line1' => '1 Pay Lane',
        'city' => 'Leeds',
        'postcode' => 'LS1 1AA',
        'property_type' => 'flat',
        'status' => 'managing',
        'strategy' => 'btl',
        'created_by' => $user->id,
    ]);

    $tenancy = PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'Paying Tenant',
        'rent_amount' => 900,
        'start_date' => now()->subMonth()->toDateString(),
        'end_date' => null,
        'deposit' => null,
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');
    $base = 'http://'.$host;

    $this->post($base.'/properties/'.$property->id.'/tenancies/'.$tenancy->id.'/payments', [
        'amount' => '125.50',
        'due_date' => '2026-06-01',
        'status' => 'pending',
        'notes' => 'June rent',
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $payment = TenancyRentPayment::query()->first();
    expect($payment)->not->toBeNull();
    expect($payment->amount_minor)->toBe(12550);
    expect($payment->tenancy_id)->toBe($tenancy->id);
    tenancy()->end();
});

it('marking payment paid sets paid_date and status', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mark paid '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mark-paid.test',
        'plan' => 'mentor_network',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = Property::query()->create([
        'address_line1' => '2 Paid Row',
        'city' => 'Manchester',
        'postcode' => 'M1 1AA',
        'property_type' => 'flat',
        'status' => 'managing',
        'strategy' => 'btl',
        'created_by' => $user->id,
    ]);

    $tenancy = PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'Tenant B',
        'rent_amount' => 800,
        'start_date' => now()->subMonth()->toDateString(),
        'end_date' => null,
        'deposit' => null,
    ]);

    $payment = TenancyRentPayment::query()->create([
        'tenancy_id' => $tenancy->id,
        'property_id' => $property->id,
        'amount_minor' => 80000,
        'due_date' => '2026-05-01',
        'paid_date' => null,
        'status' => 'pending',
        'notes' => null,
        'created_by' => $user->id,
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');
    $base = 'http://'.$host;

    $this->post($base.'/properties/'.$property->id.'/tenancies/'.$tenancy->id.'/payments/'.$payment->id.'/mark-paid', [])
        ->assertRedirect();

    tenancy()->initialize($tenant);
    $payment->refresh();
    expect($payment->status)->toBe('paid');
    expect($payment->paid_date?->toDateString())->toBe(now()->toDateString());
    tenancy()->end();
});

it('property show renders payment log', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Show pay '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@show-pay.test',
        'plan' => 'mentor_network',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = Property::query()->create([
        'address_line1' => '3 Show Street',
        'city' => 'Birmingham',
        'postcode' => 'B1 1AA',
        'property_type' => 'flat',
        'status' => 'managing',
        'strategy' => 'btl',
        'created_by' => $user->id,
    ]);

    $tenancy = PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'Tenant C',
        'rent_amount' => 700,
        'start_date' => now()->subMonth()->toDateString(),
        'end_date' => null,
        'deposit' => null,
    ]);

    TenancyRentPayment::query()->create([
        'tenancy_id' => $tenancy->id,
        'property_id' => $property->id,
        'amount_minor' => 50125,
        'due_date' => '2026-04-01',
        'paid_date' => null,
        'status' => 'paid',
        'notes' => null,
        'created_by' => $user->id,
    ]);
    TenancyRentPayment::query()->create([
        'tenancy_id' => $tenancy->id,
        'property_id' => $property->id,
        'amount_minor' => 9999,
        'due_date' => '2026-05-01',
        'paid_date' => null,
        'status' => 'pending',
        'notes' => null,
        'created_by' => $user->id,
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/properties/'.$property->id)
        ->assertOk()
        ->assertSee('501.25')
        ->assertSee('99.99');
});
