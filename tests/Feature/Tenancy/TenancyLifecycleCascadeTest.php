<?php

declare(strict_types=1);

use App\Events\Tenant\Tenancy\RentPaymentOverdue;
use App\Events\Tenant\Tenancy\TenancyCreated;
use App\Events\Tenant\Tenancy\TenancyEndingApproaching;
use App\Models\Tenant\CommunicationEnrollment;
use App\Models\Tenant\CommunicationSequence;
use App\Models\Tenant\ComplianceItem;
use App\Models\Tenant\Contact;
use App\Models\Tenant\Pipeline;
use App\Models\Tenant\PipelineDeal;
use App\Models\Tenant\PipelineStage;
use App\Models\Tenant\Property;
use App\Models\Tenant\PropertyTenancy;
use App\Models\Tenant\TenancyRentPayment;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use App\Support\Communications\CommunicationSequenceTriggers;
use Database\Seeders\Central\FeatureFlagSeeder;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
});

it('creates right to rent item when tenancy is created', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Spiderweb TC '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'spider-'.uniqid().'@test.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $property = Property::query()->create([
        'address_line1' => '1 Cascade Lane',
        'city' => 'Leeds',
        'postcode' => 'LS1 1AA',
        'property_type' => 'flat',
        'status' => 'managing',
        'strategy' => 'btl',
        'created_by' => $user->id,
    ]);
    $tenancy = PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'Cascade Tenant',
        'rent_amount' => 900,
        'start_date' => now()->subMonth()->toDateString(),
    ]);

    TenancyCreated::dispatch($tenancy);

    expect(ComplianceItem::query()
        ->where('property_id', $property->id)
        ->where('type', 'right_to_rent')
        ->exists())->toBeTrue();
    tenancy()->end();
});

it('enrols new tenant into welcome sequence when sequence exists', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Welcome TC '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'welcome-'.uniqid().'@test.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $contact = Contact::factory()->create(['email' => 'tenant-'.uniqid().'@test.test']);
    CommunicationSequence::query()->create([
        'name' => 'Welcome',
        'slug' => 'welcome-tenants',
        'trigger_key' => CommunicationSequenceTriggers::TENANT_CREATED,
        'is_active' => true,
        'created_by' => User::query()->firstOrFail()->id,
    ]);
    $tenancy = PropertyTenancy::query()->create([
        'property_id' => Property::query()->create([
            'address_line1' => '2 Welcome Road',
            'city' => 'Leeds',
            'postcode' => 'LS2 2BB',
            'property_type' => 'flat',
            'status' => 'managing',
            'strategy' => 'btl',
            'created_by' => User::query()->firstOrFail()->id,
        ])->id,
        'contact_id' => $contact->id,
        'tenant_name' => 'Welcome Tenant',
        'rent_amount' => 750,
        'start_date' => now()->toDateString(),
    ]);

    TenancyCreated::dispatch($tenancy);

    expect(CommunicationEnrollment::query()
        ->where('contact_id', $contact->id)
        ->whereHas('sequence', fn ($q) => $q->where('slug', 'welcome-tenants'))
        ->exists())->toBeTrue();
    tenancy()->end();
});

it('creates vacancy pipeline card when tenancy ends in 30 days', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Vacancy TC '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'vacancy-'.uniqid().'@test.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $property = Property::query()->create([
        'address_line1' => '3 Vacancy Close',
        'city' => 'Leeds',
        'postcode' => 'LS3 3CC',
        'property_type' => 'flat',
        'status' => 'managing',
        'strategy' => 'btl',
        'created_by' => $user->id,
    ]);
    $pipeline = Pipeline::query()->create([
        'name' => 'Default',
        'type' => 'sourcing',
        'is_default' => true,
        'created_by' => $user->id,
    ]);
    PipelineStage::query()->create([
        'pipeline_id' => $pipeline->id,
        'name' => 'Lead',
        'position' => 1,
        'is_won' => false,
        'is_lost' => false,
    ]);

    $tenancy = PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'Leaving Tenant',
        'rent_amount' => 800,
        'start_date' => now()->subYear()->toDateString(),
        'end_date' => now()->addDays(30)->toDateString(),
    ]);

    TenancyEndingApproaching::dispatch($tenancy, 30);

    expect(PipelineDeal::query()
        ->where('property_id', $property->id)
        ->where('title', 'like', 'Re-let:%')
        ->exists())->toBeTrue();
    tenancy()->end();
});

it('creates section 8 item when rent is 14 days overdue', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'S8 TC '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 's8-'.uniqid().'@test.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $property = Property::query()->create([
        'address_line1' => '4 Arrears Ave',
        'city' => 'Leeds',
        'postcode' => 'LS4 4DD',
        'property_type' => 'flat',
        'status' => 'managing',
        'strategy' => 'btl',
        'created_by' => $user->id,
    ]);
    $tenancy = PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'Arrears Tenant',
        'rent_amount' => 650,
        'start_date' => now()->subYear()->toDateString(),
    ]);
    $payment = TenancyRentPayment::query()->create([
        'tenancy_id' => $tenancy->id,
        'property_id' => $property->id,
        'amount_minor' => 50000,
        'due_date' => now()->subDays(14)->toDateString(),
        'status' => 'pending',
        'created_by' => $user->id,
    ]);

    RentPaymentOverdue::dispatch($payment, 14);

    expect(ComplianceItem::query()
        ->where('property_id', $property->id)
        ->where('type', 'section_8_notice')
        ->exists())->toBeTrue();
    tenancy()->end();
});
