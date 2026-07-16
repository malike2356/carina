<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\AmlDealLog;
use App\Models\Tenant\DealAnalysis;
use App\Models\Tenant\User;
use App\Services\Compliance\AmlDealLogService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'compliance')->update(['enabled' => true]);
});

function amlDealLogTenant(): array
{
    static $cached = null;

    if ($cached !== null) {
        return $cached;
    }

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'AML Deal Log Shared',
        'owner_name' => 'Owner',
        'owner_email' => 'owner-aml-deal-log@aml-deal-log.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $cached = [$tenant, $host, $user];

    return $cached;
}

it('creates a deal AML log', function (): void {
    [$tenant, $host, $user] = amlDealLogTenant();

    tenancy()->initialize($tenant);
    $deal = DealAnalysis::query()->create([
        'title' => 'AML test deal',
        'status' => 'draft',
        'strategy' => 'btl',
        'created_by' => $user->id,
        'metrics' => [],
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');
    $this->post('http://'.$host.'/compliance/aml/deal-logs', [
        'deal_analysis_id' => $deal->id,
        'check_date' => now()->toDateString(),
        'outcome' => 'clear',
        'risk_rating' => 'standard',
        'pep_checked' => true,
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $log = AmlDealLog::query()->where('deal_analysis_id', $deal->id)->first();
    expect($log)->not->toBeNull()
        ->and($log->outcome)->toBe('clear')
        ->and($log->checked_by_user_id)->toBe($user->id)
        ->and($log->pep_checked)->toBeTrue();
    tenancy()->end();
});

it('returns deals missing AML checks', function (): void {
    [$tenant, $host, $user] = amlDealLogTenant();

    tenancy()->initialize($tenant);
    $missing = DealAnalysis::query()->create([
        'title' => 'No AML yet',
        'status' => 'draft',
        'strategy' => 'hmo',
        'created_by' => $user->id,
        'metrics' => [],
    ]);
    $logged = DealAnalysis::query()->create([
        'title' => 'Has AML',
        'status' => 'draft',
        'strategy' => 'brr',
        'created_by' => $user->id,
        'metrics' => [],
    ]);
    AmlDealLog::factory()->create([
        'deal_analysis_id' => $logged->id,
        'checked_by_user_id' => $user->id,
    ]);

    $service = app(AmlDealLogService::class);
    $ids = $service->getDealsMissingAmlCheck()->pluck('id')->all();
    expect($ids)->toContain($missing->id)->not->toContain($logged->id);
    tenancy()->end();
});

it('flags high risk when enhanced risk rating or requires review outcome', function (): void {
    [$tenant,, $user] = amlDealLogTenant();

    tenancy()->initialize($tenant);
    $enhanced = AmlDealLog::factory()->create([
        'risk_rating' => 'enhanced',
        'outcome' => 'clear',
        'checked_by_user_id' => $user->id,
    ]);
    $review = AmlDealLog::factory()->create([
        'risk_rating' => 'standard',
        'outcome' => 'requires_review',
        'checked_by_user_id' => $user->id,
    ]);
    $low = AmlDealLog::factory()->create([
        'risk_rating' => 'low',
        'outcome' => 'clear',
        'checked_by_user_id' => $user->id,
    ]);

    expect($enhanced->isHighRisk())->toBeTrue()
        ->and($review->isHighRisk())->toBeTrue()
        ->and($low->isHighRisk())->toBeFalse();
    tenancy()->end();
});
