<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\Tenant;
use App\Models\Tenant\MentorshipProgramme;
use App\Models\Tenant\MentorshipRelationship;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Testing\TestResponse;

function mentorAssistantBootstrapFlags(): void
{
    if (! Schema::connection('central')->hasTable('feature_flags')) {
        return;
    }

    if (! FeatureFlag::query()->where('key', 'mentoring_os')->exists()) {
        (new FeatureFlagSeeder)->run();
    }
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'mentoring_os')->update(['enabled' => true]);
    FeatureFlag::query()->where('key', 'community_learning')->update(['enabled' => true]);
    FeatureFlag::query()->where('key', 'carina_ai')->update(['enabled' => true]);
}

/**
 * @return array{tenant: Tenant, host: string, tid: string}
 */
function mentorAssistantWorkspace(): array
{
    mentorAssistantBootstrapFlags();
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mentor Assistant '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-ma-'.uniqid().'@ma.test',
        'plan' => 'starter',
    ]);
    $tenant->load('domains');
    $host = $tenant->domains->first()->domain.'.propreneur.test';
    $tid = (string) $tenant->getTenantKey();

    return ['tenant' => $tenant, 'host' => $host, 'tid' => $tid];
}

function mentorAssistantHost(Tenant $tenant): string
{
    return $tenant->domains->first()->domain.'.propreneur.test';
}

/**
 * @return array{tenant: Tenant, host: string, tid: string, programme: MentorshipProgramme, mentor: User, mentee: User, relationship: MentorshipRelationship}
 */
function mentorAssistantScenario(): array
{
    ['tenant' => $tenant, 'host' => $host, 'tid' => $tid] = mentorAssistantWorkspace();

    tenancy()->initialize($tenant);

    $mentor = User::factory()->create(['password' => Hash::make('secret')]);
    $mentor->assignRole('mentor');
    $mentee = User::factory()->create(['password' => Hash::make('secret')]);
    $mentee->assignRole('mentee');

    $programme = MentorshipProgramme::query()->create([
        'tenant_id' => $tid,
        'name' => 'Accelerator',
        'description' => 'Test programme',
        'is_active' => true,
        'modules_per_week' => 1,
    ]);

    $relationship = MentorshipRelationship::query()->create([
        'tenant_id' => $tid,
        'mentorship_programme_id' => $programme->id,
        'mentor_id' => $mentor->id,
        'mentee_id' => $mentee->id,
        'status' => 'active',
        'started_at' => now()->subWeeks(2),
    ]);

    completeTenantWorkspaceOnboarding();
    mentorAssistantEnableFlagsForTenant($tid);
    tenancy()->end();

    return [
        'tenant' => $tenant,
        'host' => $host,
        'tid' => $tid,
        'programme' => $programme,
        'programmeId' => (int) $programme->id,
        'mentor' => $mentor,
        'mentee' => $mentee,
        'relationship' => $relationship,
    ];
}

function mentorAssistantEnableFlagsForTenant(string $tenantId): void
{
    if (! Schema::connection('central')->hasTable('feature_flags')) {
        return;
    }

    foreach (['mentoring_os', 'carina_ai', 'community_learning'] as $key) {
        $flag = FeatureFlag::query()->where('key', $key)->first();
        $flag?->setTenantOverride($tenantId, true);
    }
}

function mentorAssistantUrl(string $host, string $path): string
{
    return tenantHttpUrl($host, $path);
}

function mentorAssistantFreshUser(User $user, Tenant $tenant): User
{
    tenancy()->initialize($tenant);
    $fresh = User::query()->findOrFail($user->id);
    tenancy()->end();

    return $fresh;
}

function mentorAssistantGetAs(User $user, string $host, string $path, ?Tenant $tenant = null): TestResponse
{
    if ($tenant !== null) {
        $user = mentorAssistantFreshUser($user, $tenant);
    }

    return test()->actingAs($user, 'web')
        ->get(mentorAssistantUrl($host, $path));
}

function mentorAssistantPostAs(User $user, string $host, string $path, array $data = [], ?Tenant $tenant = null): TestResponse
{
    if ($tenant !== null) {
        $user = mentorAssistantFreshUser($user, $tenant);
    }

    return test()->actingAs($user, 'web')
        ->post(mentorAssistantUrl($host, $path), $data);
}
