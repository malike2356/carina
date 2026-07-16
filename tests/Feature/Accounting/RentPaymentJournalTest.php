<?php

declare(strict_types=1);

use App\Events\Tenant\Tenancy\RentPaymentMarkedPaid;
use App\Listeners\Tenancy\CreateRentIncomeJournalOnPaymentPaid;
use App\Models\Tenant\GlAccount;
use App\Models\Tenant\JournalEntry;
use App\Models\Tenant\Property;
use App\Models\Tenant\PropertyTenancy;
use App\Models\Tenant\TenancyRentPayment;
use App\Models\Tenant\User;
use App\Services\Accounting\ChartOfAccountsService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
});

it('creates rent income journal when payment marked paid', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Rent JE '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'rent-je-'.uniqid().'@test.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    GlAccount::query()->delete();
    app(ChartOfAccountsService::class)->ensureDefaultAccounts();
    $property = Property::query()->create([
        'address_line1' => '20 Rent Street',
        'city' => 'Leeds',
        'postcode' => 'LS20 1AA',
        'property_type' => 'flat',
        'status' => 'managing',
        'strategy' => 'btl',
        'created_by' => $user->id,
    ]);
    $tenancy = PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'Paying Tenant',
        'rent_amount' => 850,
        'start_date' => now()->subMonth()->toDateString(),
    ]);
    $payment = TenancyRentPayment::query()->create([
        'tenancy_id' => $tenancy->id,
        'property_id' => $property->id,
        'amount_minor' => 85000,
        'due_date' => now()->toDateString(),
        'paid_date' => now()->toDateString(),
        'status' => 'paid',
        'created_by' => $user->id,
    ]);

    app(CreateRentIncomeJournalOnPaymentPaid::class)
        ->handle(new RentPaymentMarkedPaid($payment->fresh(['tenancy.property', 'tenancy.contact'])));

    expect(JournalEntry::query()->where('reference', 'RENT-'.$payment->id)->exists())->toBeTrue();
    tenancy()->end();
});

it('links journal entry id back to payment', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Rent link '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'rent-link-'.uniqid().'@test.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    GlAccount::query()->delete();
    app(ChartOfAccountsService::class)->ensureDefaultAccounts();
    $property = Property::query()->create([
        'address_line1' => '21 Link Lane',
        'city' => 'Leeds',
        'postcode' => 'LS21 1BB',
        'property_type' => 'flat',
        'status' => 'managing',
        'strategy' => 'btl',
        'created_by' => $user->id,
    ]);
    $tenancy = PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'Linked Tenant',
        'rent_amount' => 1200,
        'start_date' => now()->subMonth()->toDateString(),
    ]);
    $payment = TenancyRentPayment::query()->create([
        'tenancy_id' => $tenancy->id,
        'property_id' => $property->id,
        'amount_minor' => 120000,
        'due_date' => now()->toDateString(),
        'paid_date' => now()->toDateString(),
        'status' => 'paid',
        'created_by' => $user->id,
    ]);

    app(CreateRentIncomeJournalOnPaymentPaid::class)
        ->handle(new RentPaymentMarkedPaid($payment->fresh(['tenancy.property', 'tenancy.contact'])));

    $payment->refresh();
    expect($payment->journal_entry_id)->not->toBeNull();
    tenancy()->end();
});
