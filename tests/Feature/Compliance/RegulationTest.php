<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\ComplianceRequirement;
use App\Models\Tenant\Regulation;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'compliance')->update(['enabled' => true]);
});

function regulationTestTenant(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Regulation Registry '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@regulation-registry.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    return [$tenant, $host, $user];
}

it('creates a regulation', function (): void {
    [$tenant, $host, $user] = regulationTestTenant();

    $this->actingAs($user, 'web');
    $this->post('http://'.$host.'/compliance/regulations', [
        'name' => 'Custom Local Regulation',
        'short_code' => 'CUSTOM_001',
        'category' => 'general',
        'description' => 'Workspace-specific guidance.',
        'is_active' => '1',
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $regulation = Regulation::query()->where('short_code', 'CUSTOM_001')->first();
    expect($regulation)->not->toBeNull()
        ->and($regulation->name)->toBe('Custom Local Regulation')
        ->and($regulation->is_active)->toBeTrue();
    tenancy()->end();
});

it('archives a regulation setting is_active to false', function (): void {
    [$tenant, $host, $user] = regulationTestTenant();

    tenancy()->initialize($tenant);
    $regulation = Regulation::query()->where('short_code', 'HHSRS')->firstOrFail();
    tenancy()->end();

    $this->actingAs($user, 'web');
    $this->post('http://'.$host.'/compliance/regulations/'.$regulation->id.'/archive')
        ->assertRedirect('http://'.$host.'/compliance/regulations');

    tenancy()->initialize($tenant);
    expect(Regulation::query()->find($regulation->id)?->is_active)->toBeFalse();
    tenancy()->end();
});

it('links a ComplianceRequirement to a Regulation', function (): void {
    [$tenant, $host, $user] = regulationTestTenant();

    tenancy()->initialize($tenant);
    $regulation = Regulation::query()->where('short_code', 'GAS_SAFETY_1998')->firstOrFail();
    $requirement = ComplianceRequirement::factory()->create([
        'name' => 'Annual gas safety certificate',
        'regulation_id' => $regulation->id,
        'created_by' => $user->id,
    ]);
    tenancy()->end();

    tenancy()->initialize($tenant);
    $requirement->refresh();
    expect($requirement->regulation?->id)->toBe($regulation->id)
        ->and($regulation->requirements()->whereKey($requirement->id)->exists())->toBeTrue();
    tenancy()->end();
});

it('seeds canonical UK regulations on tenant migration', function (): void {
    [$tenant] = regulationTestTenant();

    tenancy()->initialize($tenant);
    expect(Regulation::query()->count())->toBe(12)
        ->and(Regulation::query()->where('short_code', 'RRA_2025')->exists())->toBeTrue()
        ->and(Regulation::query()->where('short_code', 'EICR_2020')->exists())->toBeTrue();
    tenancy()->end();
});
