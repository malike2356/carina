<?php

declare(strict_types=1);

use App\DemoData\Services\DemoDataService;
use App\Models\Central\FeatureFlag;
use App\Models\Central\PlatformUser;
use App\Models\Central\Tenant;
use App\Models\Tenant\Contact;
use App\Models\Tenant\Property;
use App\Models\Tenant\User;
use App\Services\Onboarding\WorkspaceOnboardingService;
use App\Services\Tenancy\PresentationDemoWorkspaceResetService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Support\Str;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'saas_tenant_management')->update(['enabled' => true]);

    config([
        'presentation_demo.default_profile' => 'mixed_portfolio',
        'presentation_demo.mark_owner_verified' => true,
        'presentation_demo.complete_onboarding_deferred' => true,
    ]);
});

function createPresentationDemoTenantForReset(): Tenant
{
    $slug = 'demo-reset-'.Str::lower(Str::random(8));
    config(['presentation_demo.allowlisted_slugs' => [$slug]]);

    $label = Str::lower(Str::random(8));

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Presentation Reset '.$label,
        'owner_name' => 'Demo Owner',
        'owner_email' => 'presentation-reset-'.$label.'@demo.test',
        'plan' => 'operator',
        'slug' => $slug,
        'send_welcome_email' => false,
    ]);

    tenancy()->initialize($tenant);
    app(DemoDataService::class)->import('mixed_portfolio');
    $userId = (int) (User::query()->orderBy('id')->value('id') ?? 1);
    Contact::query()->create([
        'first_name' => 'Visitor',
        'last_name' => 'Contact',
        'email' => 'visitor-'.$label.'@example.test',
        'created_by' => $userId,
        'is_demo_data' => false,
    ]);
    tenancy()->end();

    return $tenant->fresh();
}

it('resets allowlisted workspace to demo profile and clears visitor data', function (): void {
    $tenant = createPresentationDemoTenantForReset();

    tenancy()->initialize($tenant);
    expect(Contact::query()->where('is_demo_data', false)->where('first_name', 'Visitor')->exists())->toBeTrue()
        ->and(Property::demoData()->count())->toBeGreaterThan(0);
    tenancy()->end();

    $result = app(PresentationDemoWorkspaceResetService::class)->reset($tenant);

    expect($result->tenantSlug)->toBe((string) $tenant->slug)
        ->and($result->profileSlug)->toBe('mixed_portfolio')
        ->and($result->demoBatchId)->not->toBe('');

    tenancy()->initialize($tenant);
    expect(Contact::query()->where('first_name', 'Visitor')->exists())->toBeFalse()
        ->and(Property::demoData()->count())->toBeGreaterThan(0)
        ->and(app(WorkspaceOnboardingService::class)->isCompleted())->toBeTrue();

    $owner = User::query()->where('email', $tenant->owner_email)->first();
    expect($owner)->not->toBeNull()
        ->and($owner->email_verified_at)->not->toBeNull();
    tenancy()->end();

    $tenant->refresh();
    expect($tenant->workspace_onboarding_completed_at)->not->toBeNull();
});

it('resets presentation workspace from platform admin', function (): void {
    $tenant = createPresentationDemoTenantForReset();
    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->post(route('admin.saas-tenancy.reset-presentation-workspace', $tenant), [
            'profile' => 'mixed_portfolio',
        ])
        ->assertRedirect()
        ->assertSessionHas('success');

    tenancy()->initialize($tenant);
    expect(Contact::demoData()->count())->toBeGreaterThan(0);
    tenancy()->end();
});

it('forbids reset for non-allowlisted slug', function (): void {
    config(['presentation_demo.allowlisted_slugs' => ['demo-only']]);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Not Demo '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'not-demo-'.uniqid().'@test.test',
        'plan' => 'starter',
        'send_welcome_email' => false,
    ]);

    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->post(route('admin.saas-tenancy.reset-presentation-workspace', $tenant))
        ->assertRedirect()
        ->assertSessionHas('error');
});

it('forbids reset without manage permission', function (): void {
    $tenant = createPresentationDemoTenantForReset();
    $viewer = PlatformUser::factory()->create(['role' => 'support']);

    $this->actingAs($viewer, 'platform')
        ->post(route('admin.saas-tenancy.reset-presentation-workspace', $tenant))
        ->assertForbidden();
});
