<?php

declare(strict_types=1);

use App\Models\Tenant\Asset;
use App\Models\Tenant\User;
use App\Services\Assets\AssetManagerService;
use App\Services\Assets\NetWorthService;
use App\Services\Tenancy\TenantCreationService;

it('stores GHS currency on asset create', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'FX Asset '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@fx.test',
        'plan' => 'professional',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();

    $asset = app(AssetManagerService::class)->createAsset([
        'name' => 'CalBank GH',
        'category' => 'cash_account',
        'current_value' => 50000,
        'currency' => 'GHS',
        'exchange_rate_to_gbp' => 0.062,
    ], $user);

    expect($asset->currency)->toBe('GHS')
        ->and($asset->valuations)->not->toBeEmpty()
        ->and((float) $asset->valuations->first()->exchange_rate_to_gbp)->toBe(0.062);

    tenancy()->end();
});

it('converts non-GBP assets using exchange_rate_to_gbp in net worth', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'FX NW '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@fx-nw.test',
        'plan' => 'professional',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();

    app(AssetManagerService::class)->createAsset([
        'name' => 'GBP Cash',
        'category' => 'cash_account',
        'current_value' => 10000,
        'currency' => 'GBP',
    ], $user);

    app(AssetManagerService::class)->createAsset([
        'name' => 'GHS Account',
        'category' => 'cash_account',
        'current_value' => 100000,
        'currency' => 'GHS',
        'exchange_rate_to_gbp' => 0.05,
    ], $user);

    $service = app(NetWorthService::class);
    $byCurrency = $service->netWorthByCurrency();

    expect($byCurrency['currencies'])->toHaveCount(2);

    $ghs = collect($byCurrency['currencies'])->firstWhere('currency', 'GHS');
    expect($ghs)->not->toBeNull()
        ->and($ghs['assets'])->toBe(100000.0)
        ->and($ghs['gbp_equivalent'])->toBe(5000.0);

    expect($service->netWorthInBaseCurrency())->toBe(15000.0);

    tenancy()->end();
});

it('round-trips asset valuation with exchange rate', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'FX RT '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@fx-rt.test',
        'plan' => 'professional',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();

    $asset = app(AssetManagerService::class)->createAsset([
        'name' => 'AED Account',
        'category' => 'cash_account',
        'current_value' => 20000,
        'currency' => 'AED',
        'exchange_rate_to_gbp' => 0.21,
    ], $user);

    $valuation = $asset->valuations()->first();
    expect($valuation->currency)->toBe('AED')
        ->and((float) $valuation->value)->toBe(20000.0)
        ->and((float) $valuation->exchange_rate_to_gbp)->toBe(0.21);

    $asset = Asset::query()->findOrFail($asset->id);
    expect(app(NetWorthService::class)->valueInBaseCurrency($asset))->toBe(4200.0);

    tenancy()->end();
});
