<?php

declare(strict_types=1);
use App\Models\Central\FeatureFlag;
use App\Models\Tenant\MentorshipProgramme;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Database\Seeders\Central\SubscriptionPlanSeeder;
use Illuminate\Support\Facades\Hash;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    $this->seed(SubscriptionPlanSeeder::class);
    FeatureFlag::query()->where('key', 'mentoring_os')->update(['enabled' => true]);
});

it('shows programme via mobile mentoring-os API', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mobile Mentor '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mobile-mentor.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';
    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'mentoring_os')->update(['enabled' => true]);
    $tid = (string) $tenant->getTenantKey();
    $prog = MentorshipProgramme::query()->create([
        'tenant_id' => $tid,
        'name' => 'Test Programme',
        'is_active' => true,
    ]);
    $user = User::query()->where('email', $tenant->owner_email)->firstOrFail();
    $user->forceFill(['password' => Hash::make('secret-password')])->save();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $login = $this->postJson('http://'.$host.'/api/v1/mobile/auth/login', [
        'email' => $tenant->owner_email,
        'password' => 'secret-password',
        'device_uuid' => '22222222-2222-2222-2222-222222222222',
    ]);
    $login->assertOk();
    $headers = ['Authorization' => 'Bearer '.$login->json('access_token')];

    $this->getJson('http://'.$host.'/api/v1/mobile/mentoring-os/programmes', $headers)->assertOk();
    $show = $this->getJson('http://'.$host.'/api/v1/mobile/mentoring-os/programmes/'.$prog->id, $headers);
    $show->assertOk()->assertJsonPath('data.name', 'Test Programme');

    $cohorts = $this->getJson('http://'.$host.'/api/v1/mobile/mentoring-os/programmes/'.$prog->id.'/cohorts', $headers);
    $cohorts->assertOk()->assertJsonStructure(['data']);
});
