<?php

declare(strict_types=1);

use App\Models\Tenant\DealAnalysis;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Carbon;
use Tests\Concerns\RefreshDatabase;

uses(RefreshDatabase::class);

it('deal model accepts sourcing intelligence fields', function (): void {
    Carbon::setTestNow('2026-05-16 12:00:00');

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Sourcing Intel '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@sourcing-intel.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();

    $deal = DealAnalysis::query()->create([
        'property_id' => null,
        'created_by' => $user->id,
        'strategy' => 'btl',
        'title' => 'Chain break BMV',
        'metrics' => ['asking_price' => 200000],
        'status' => 'draft',
        'source_channel' => 'estate_agent',
        'seller_motivation_category' => 'chain_break',
        'is_seller_distressed' => true,
        'is_property_distressed' => false,
        'seller_deadline_date' => now()->addDays(30),
    ]);

    $fresh = $deal->fresh();

    expect($fresh->seller_motivation_category)->toBe('chain_break')
        ->and($fresh->is_seller_distressed)->toBeTrue()
        ->and($fresh->seller_deadline_date)->not->toBeNull();

    tenancy()->end();
});
