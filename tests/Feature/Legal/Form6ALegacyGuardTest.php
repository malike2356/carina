<?php

declare(strict_types=1);

use App\Models\Tenant\LegalNotice;
use App\Models\Tenant\Property;
use App\Models\Tenant\PropertyTenancy;
use App\Models\Tenant\User;
use App\Services\Legal\LegalNoticeService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Validation\ValidationException;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    config(['nexio.rra_2025_implementation_date' => '2025-10-01']);
});

it('refuses Form 6A drafting for post-RRA 2025 tenancy with correct error', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Form6A Block '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'form6a-block-'.uniqid().'@test.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();

    $property = Property::query()->create([
        'address_line1' => '9 New Law Road',
        'city' => 'Leeds',
        'postcode' => 'LS9 9AA',
        'property_type' => 'flat',
        'status' => 'managing',
        'created_by' => $user->id,
    ]);

    $tenancy = PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'New Tenant',
        'rent_amount' => 900,
        'start_date' => '2025-11-01',
    ]);

    $service = app(LegalNoticeService::class);

    expect(fn () => $service->draftForm6A($tenancy, $user))
        ->toThrow(ValidationException::class, "Section 21 is not available for tenancies created after the Renters' Rights Act 2025");

    tenancy()->end();
});

it('allows Form 6A drafting for pre-RRA 2025 tenancy', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Form6A OK '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'form6a-ok-'.uniqid().'@test.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();

    $property = Property::query()->create([
        'address_line1' => '8 Legacy Lane',
        'city' => 'Leeds',
        'postcode' => 'LS8 8AA',
        'property_type' => 'flat',
        'status' => 'managing',
        'created_by' => $user->id,
    ]);

    $tenancy = PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'Legacy Tenant',
        'rent_amount' => 750,
        'start_date' => '2024-03-01',
    ]);

    $notice = app(LegalNoticeService::class)->draftForm6A($tenancy, $user);

    expect($notice->notice_type)->toBe(LegalNotice::TYPE_FORM_6A_LEGACY)
        ->and($notice->content_snapshot['legacy_section_21'])->toBeTrue();

    tenancy()->end();
});
