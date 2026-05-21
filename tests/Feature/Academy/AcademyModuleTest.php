<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\AcademyLesson;
use App\Models\Tenant\AcademyLessonProgress;
use App\Models\Tenant\AcademyTrack;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'academy')->update(['enabled' => true]);
});

function academyModuleTenant(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Academy Test '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@academy-test.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    return [$tenant, $host, $user];
}

function seedAcademyFixtures(object $tenant): array
{
    $track = null;
    $lesson = null;

    $tenant->run(function () use (&$track, &$lesson): void {
        $track = AcademyTrack::query()->create([
            'slug' => 'btl-fundamentals',
            'title' => 'BTL Fundamentals',
            'description' => 'Learn buy-to-let investing from first principles.',
            'excerpt' => 'A concise intro to buy-to-let investing.',
            'order' => 0,
            'total_lessons' => 1,
        ]);

        $lesson = AcademyLesson::query()->create([
            'track_id' => $track->getKey(),
            'slug' => 'what-is-btl',
            'title' => 'What is BTL?',
            'excerpt' => 'A quick overview of buy-to-let investing.',
            'content' => '## What is BTL?'."\n\n".'Buy-to-let means purchasing property to rent out.',
            'order' => 0,
            'estimated_minutes' => 5,
        ]);
    });

    return [$track, $lesson];
}

it('tenant user can view academy index', function (): void {
    [$tenant, $host, $user] = academyModuleTenant();
    seedAcademyFixtures($tenant);

    $this->actingAs($user, 'web')
        ->get("http://{$host}/academy")
        ->assertOk()
        ->assertSee('BTL Fundamentals');
});

it('tenant user can view a track', function (): void {
    [$tenant, $host, $user] = academyModuleTenant();
    seedAcademyFixtures($tenant);

    $this->actingAs($user, 'web')
        ->get("http://{$host}/academy/btl-fundamentals")
        ->assertOk()
        ->assertSee('BTL Fundamentals')
        ->assertSee('What is BTL?');
});

it('tenant user can view a lesson and viewed_at is set', function (): void {
    [$tenant, $host, $user] = academyModuleTenant();
    [, $lesson] = seedAcademyFixtures($tenant);

    $this->actingAs($user, 'web')
        ->get("http://{$host}/academy/btl-fundamentals/what-is-btl")
        ->assertOk()
        ->assertSee('What is BTL?');

    $tenant->run(function () use ($user, $lesson): void {
        $progress = AcademyLessonProgress::query()
            ->where('user_id', $user->getKey())
            ->where('lesson_id', $lesson->getKey())
            ->first();

        expect($progress)->not->toBeNull()
            ->and($progress->viewed_at)->not->toBeNull();
    });
});

it('tenant user can mark a lesson complete', function (): void {
    [$tenant, $host, $user] = academyModuleTenant();
    [, $lesson] = seedAcademyFixtures($tenant);

    $this->actingAs($user, 'web')
        ->post("http://{$host}/academy/btl-fundamentals/what-is-btl/complete")
        ->assertRedirect();

    $tenant->run(function () use ($user, $lesson): void {
        $progress = AcademyLessonProgress::query()
            ->where('user_id', $user->getKey())
            ->where('lesson_id', $lesson->getKey())
            ->first();

        expect($progress)->not->toBeNull()
            ->and($progress->completed_at)->not->toBeNull();
    });
});

it('unauthenticated user is redirected from academy', function (): void {
    [$tenant, $host] = academyModuleTenant();
    seedAcademyFixtures($tenant);

    $this->get("http://{$host}/academy")
        ->assertRedirect();
});
