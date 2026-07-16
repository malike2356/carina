<?php

declare(strict_types=1);

use App\Models\Tenant\Property;
use App\Models\Tenant\TenancyAgreement;
use App\Models\Tenant\User;
use App\Services\Compliance\TenancyAgreementService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Carbon;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

function tenancyAgreementTestContext(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Tenancy Agreement '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@tenancy-agreement.test',
        'plan' => 'mentor_network',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = Property::query()->create([
        'address_line1' => '10 Agreement Avenue',
        'city' => 'Leeds',
        'postcode' => 'LS1 1AA',
        'property_type' => 'flat',
        'status' => 'managing',
        'strategy' => 'btl',
        'created_by' => $user->id,
    ]);

    tenancy()->end();

    return [$tenant, $host, $user, $property];
}

it('creates a tenancy agreement with deposit protection deadline auto-computed', function (): void {
    [$tenant, $host, $user, $property] = tenancyAgreementTestContext();

    $this->actingAs($user, 'web');
    $base = 'http://'.$host;

    $this->post($base.'/tenancy-agreements', [
        'property_id' => $property->id,
        'tenant_name' => 'Sam Tenant',
        'tenancy_type' => 'ast',
        'lease_start_date' => '2026-01-01',
        'lease_end_date' => '2027-01-01',
        'rent_pcm' => '950',
        'rent_schedule' => 'monthly',
        'deposit_amount' => '1000',
        'status' => 'active',
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $agreement = TenancyAgreement::query()->where('tenant_name', 'Sam Tenant')->firstOrFail();
    expect($agreement->deposit_protection_deadline?->toDateString())->toBe('2026-01-31');
    tenancy()->end();
});

it('returns true from isDepositProtectionOverdue when past deadline with no certificate', function (): void {
    Carbon::setTestNow('2026-03-01');

    $agreement = new TenancyAgreement([
        'deposit_amount' => 1000,
        'deposit_certificate_number' => null,
        'deposit_protection_deadline' => '2026-02-01',
    ]);

    expect($agreement->isDepositProtectionOverdue())->toBeTrue();

    Carbon::setTestNow();
});

it('records Section 21 served date via service', function (): void {
    [$tenant, , , $property] = tenancyAgreementTestContext();

    tenancy()->initialize($tenant);
    $agreement = app(TenancyAgreementService::class)->create([
        'property_id' => $property->id,
        'tenant_name' => 'Notice Tenant',
        'tenancy_type' => 'ast',
        'lease_start_date' => '2026-01-01',
        'rent_pcm' => 900,
        'rent_schedule' => 'monthly',
        'status' => 'active',
    ]);

    app(TenancyAgreementService::class)->serveSection21($agreement, Carbon::parse('2026-04-15'));

    $agreement->refresh();

    expect($agreement->section_21_served_date?->toDateString())->toBe('2026-04-15')
        ->and($agreement->status)->toBe('notice_given');
    tenancy()->end();
});

it('returns red rag status when Section 21 is served', function (): void {
    $agreement = new TenancyAgreement([
        'section_21_served_date' => '2026-04-01',
        'is_periodic' => false,
    ]);

    expect($agreement->getRagStatus())->toBe('red');
});
