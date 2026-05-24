<?php

declare(strict_types=1);

use App\Models\Central\Tenant;
use App\Models\Tenant\ComplianceScore;
use App\Models\Tenant\FireSafetyLog;
use App\Models\Tenant\OnboardingJourney;
use App\Models\Tenant\Room;
use App\Models\Tenant\TenantSetting;
use App\Models\Tenant\User;
use App\Services\Onboarding\HmoOnboardingService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

/**
 * @return array{0: Tenant, 1: User, 2: string}
 */
function hmoOnboardingTenant(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'HMO Onboard '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@hmo-onboard.test',
        'plan' => 'mentor_network',
    ]);
    $tenant->persona = 'hmo';
    $tenant->save();

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    TenantSetting::query()->where('key', 'workspace_onboarding')->delete();
    tenancy()->end();

    $host = $tenant->domains->firstOrFail()->domain.'.propreneur.test';
    test()->actingAs($user, 'web');

    return [$tenant, $user, $host];
}

function hmoStepPayload(int $step): array
{
    return match ($step) {
        1 => [
            'address_line1' => '10 Wizard Lane',
            'city' => 'Leeds',
            'postcode' => 'LS1 4AB',
            'rooms_count' => 4,
            'hmo_license_type' => 'mandatory',
            'hmo_license_number' => 'HMO-123',
            'hmo_license_authority' => 'Leeds City Council',
            'hmo_license_expiry' => now()->addYear()->toDateString(),
        ],
        2 => [
            'rooms' => [
                ['name' => 'Room 1', 'room_type' => 'single', 'status' => 'available', 'rent_pcm' => 550],
            ],
        ],
        3 => ['skip' => 1],
        4 => [
            'gas_safety_expiry' => now()->addMonths(6)->toDateString(),
            'eicr_expiry' => now()->addMonths(3)->toDateString(),
            'epc_expiry' => now()->addYears(2)->toDateString(),
        ],
        5 => [
            'fire_alarm_test_date' => now()->subDays(10)->toDateString(),
        ],
        default => [],
    };
}

it('completing step 2 creates room records linked to the property', function (): void {
    [$tenant, $user, $host] = hmoOnboardingTenant();

    test()->post(tenantHttpUrl($host, '/onboarding/hmo/step/1'), hmoStepPayload(1));
    test()->post(tenantHttpUrl($host, '/onboarding/hmo/step/2'), hmoStepPayload(2));

    tenancy()->initialize($tenant);
    $propertyId = (int) app(HmoOnboardingService::class)->getState()['property_id'];
    expect(Room::query()->where('property_id', $propertyId)->count())->toBe(1);
    tenancy()->end();
});

it('completing step 5 seeds a fire safety log with correct next_due_at', function (): void {
    [$tenant, $user, $host] = hmoOnboardingTenant();
    $testDate = now()->subDays(10)->toDateString();

    foreach ([1, 2, 3, 4] as $step) {
        test()->post(tenantHttpUrl($host, '/onboarding/hmo/step/'.$step), hmoStepPayload($step));
    }

    test()->post(tenantHttpUrl($host, '/onboarding/hmo/step/5'), [
        'fire_alarm_test_date' => $testDate,
    ]);

    tenancy()->initialize($tenant);
    $propertyId = (int) app(HmoOnboardingService::class)->getState()['property_id'];
    $log = FireSafetyLog::query()
        ->where('property_id', $propertyId)
        ->where('log_type', FireSafetyLog::TYPE_FIRE_ALARM_TEST)
        ->first();

    expect($log)->not->toBeNull()
        ->and($log->performed_at->toDateString())->toBe($testDate)
        ->and($log->next_due_at?->toDateString())->toBe(now()->parse($testDate)->addDays(7)->toDateString());
    tenancy()->end();
});

it('completion service generates first compliance score snapshot', function (): void {
    [$tenant, $user, $host] = hmoOnboardingTenant();

    foreach ([1, 2, 3, 4, 5] as $step) {
        test()->post(tenantHttpUrl($host, '/onboarding/hmo/step/'.$step), hmoStepPayload($step));
    }

    test()->post(tenantHttpUrl($host, '/onboarding/hmo/complete'), ['confirm' => 1]);

    tenancy()->initialize($tenant);
    $propertyId = (int) app(HmoOnboardingService::class)->getState()['property_id'];
    expect(ComplianceScore::query()->where('property_id', $propertyId)->exists())->toBeTrue();
    tenancy()->end();
});

it('completing all 6 steps marks journey as complete', function (): void {
    [$tenant, $user, $host] = hmoOnboardingTenant();

    foreach ([1, 2, 3, 4, 5] as $step) {
        test()->post(tenantHttpUrl($host, '/onboarding/hmo/step/'.$step), hmoStepPayload($step));
    }

    test()->post(tenantHttpUrl($host, '/onboarding/hmo/complete'), ['confirm' => 1])
        ->assertRedirect(route('tenant.dashboard', [], false));

    tenancy()->initialize($tenant);
    expect(app(HmoOnboardingService::class)->isCompleted())->toBeTrue()
        ->and(OnboardingJourney::query()->where('user_id', $user->id)->value('complete'))->toBeTrue();
    tenancy()->end();
});
