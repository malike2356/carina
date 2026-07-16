<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\User;
use App\Models\Tenant\Vcal\VcalAvailabilityRule;
use App\Models\Tenant\Vcal\VcalBlackoutDate;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Tests\Concerns\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('patches availability rules and blackouts via the tenant viCal API', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'viCal API '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@vical-api.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'booking_calendar')->update(['enabled' => true]);

    $user = User::query()->firstOrFail();

    $rule = VcalAvailabilityRule::query()->create([
        'user_id' => $user->id,
        'weekday' => 1,
        'starts_at' => '09:00:00',
        'ends_at' => '12:00:00',
        'timezone' => 'Europe/London',
        'is_active' => true,
    ]);

    $blackout = VcalBlackoutDate::query()->create([
        'user_id' => $user->id,
        'starts_on' => '2026-08-01',
        'ends_on' => '2026-08-02',
        'reason' => 'Away',
    ]);

    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $ruleId = (int) $rule->getKey();
    $blackoutId = (int) $blackout->getKey();

    $this->actingAs($user, 'web');

    $patchRule = $this->patchJson('http://'.$host.'/api/vcal/availability-rules/'.$ruleId, [
        'weekday' => 4,
        'starts_at' => '10:00',
        'ends_at' => '16:00',
        'timezone' => 'Europe/London',
        'is_active' => true,
    ]);
    $patchRule->assertOk();
    expect($patchRule->json('data.weekday'))->toBe(4);

    $patchBo = $this->patchJson('http://'.$host.'/api/vcal/blackouts/'.$blackoutId, [
        'starts_on' => '2026-09-01',
        'ends_on' => '2026-09-05',
        'reason' => 'Conference',
    ]);
    $patchBo->assertOk();
    expect($patchBo->json('data.reason'))->toBe('Conference');

    tenancy()->initialize($tenant);
    $rule->refresh();
    $blackout->refresh();
    expect($rule->weekday)->toBe(4)
        ->and($blackout->starts_on?->format('Y-m-d'))->toBe('2026-09-01');
    tenancy()->end();
});
