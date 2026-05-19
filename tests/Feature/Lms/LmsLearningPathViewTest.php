<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\Tenant;
use App\Models\Tenant\Course;
use App\Models\Tenant\LearningPath;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;

beforeEach(function (): void {
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'community_learning')->update(['enabled' => true]);
});

function lmsPathHost(Tenant $tenant): string
{
    return $tenant->domains->first()->domain.'.propreneur.test';
}

it('renders learning path detail with ordered courses', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'LMS Path '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'lms-path-'.uniqid().'@test.test',
        'plan' => 'academy',
    ]);
    $tenant->load('domains');
    $host = lmsPathHost($tenant);

    $tenantKey = (string) $tenant->getTenantKey();
    tenancy()->initialize($tenant);
    $courseA = Course::query()->create(['tenant_id' => $tenantKey, 'name' => 'Alpha', 'description' => 'First']);
    $courseB = Course::query()->create(['tenant_id' => $tenantKey, 'name' => 'Beta', 'description' => 'Second']);
    $path = LearningPath::query()->create([
        'tenant_id' => $tenantKey,
        'name' => 'Onboarding path',
        'description' => 'Start here',
        'courses' => [$courseB->id, $courseA->id],
        'is_published' => true,
    ]);
    $user = User::query()->where('email', $tenant->owner_email)->first();
    tenancy()->end();

    $this->actingAs($user, 'web')
        ->get("http://{$host}/lms/learning-paths/{$path->id}")
        ->assertOk()
        ->assertSee('Onboarding path', false)
        ->assertSeeInOrder(['Beta', 'Alpha'], false);
});
