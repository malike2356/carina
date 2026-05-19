<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\Tenant;
use App\Models\Tenant\MentorshipPackage;
use App\Models\Tenant\TenantRole;
use App\Models\Tenant\User;
use App\Models\Tenant\Vcal\VcalEventType;
use App\Services\MentoringOs\MentorProfileService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::syncFromCatalogue();
    $this->withoutMiddleware(VerifyCsrfToken::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'booking_calendar')->update(['enabled' => true]);
    FeatureFlag::query()->where('key', 'mentoring_os')->update(['enabled' => true]);
});

function publicMentorHost(Tenant $tenant): string
{
    return $tenant->domains->first()->domain.'.propreneur.test';
}

function makePublishedMentor(array $overrides = []): User
{
    TenantRole::query()->firstOrCreate(['name' => 'mentor', 'guard_name' => 'web']);

    $mentor = User::factory()->create(array_merge([
        'name' => 'John Smith',
        'email' => 'mentor-'.uniqid().'@profile.test',
    ], $overrides));
    $mentor->assignRole('mentor');
    $mentor->forceFill([
        'mentor_directory_opt_in' => true,
        'mentor_directory_headline' => 'BRR specialist',
        'mentor_directory_bio' => 'Twelve years building portfolios across the North West.',
        'mentor_directory_slug' => $overrides['mentor_directory_slug'] ?? 'john-smith',
        'mentor_directory_specialisms' => ['BTL', 'HMO'],
    ])->save();

    return $mentor->fresh();
}

it('returns 200 for a published mentor profile', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Profile Pub '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@profile-pub.test',
        'plan' => 'starter',
    ]);
    $host = publicMentorHost($tenant);

    tenancy()->initialize($tenant);
    $mentor = makePublishedMentor(['mentor_directory_slug' => 'published-'.uniqid()]);
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->get('http://'.$host.'/mentors/'.$mentor->mentor_directory_slug)
        ->assertOk()
        ->assertSee('John Smith')
        ->assertSee('BRR specialist');
});

it('returns 404 when mentor has not opted in', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Profile OptOut '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@profile-optout.test',
        'plan' => 'starter',
    ]);
    $host = publicMentorHost($tenant);

    tenancy()->initialize($tenant);
    $mentor = User::factory()->create(['name' => 'Hidden Mentor']);
    $mentor->assignRole('mentor');
    $mentor->forceFill([
        'mentor_directory_opt_in' => false,
        'mentor_directory_slug' => 'hidden-mentor',
    ])->save();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->get('http://'.$host.'/mentors/hidden-mentor')->assertNotFound();
});

it('returns 404 for a non-existent slug', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Profile Missing '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@profile-missing.test',
        'plan' => 'starter',
    ]);
    $host = publicMentorHost($tenant);

    tenancy()->initialize($tenant);
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->get('http://'.$host.'/mentors/does-not-exist')->assertNotFound();
});

it('shows headline bio and specialisms on the profile page', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Profile Content '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@profile-content.test',
        'plan' => 'starter',
    ]);
    $host = publicMentorHost($tenant);
    $tid = (string) $tenant->getTenantKey();

    tenancy()->initialize($tenant);
    $mentor = makePublishedMentor(['mentor_directory_slug' => 'content-mentor']);
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->get('http://'.$host.'/mentors/content-mentor')
        ->assertOk()
        ->assertSee('BRR specialist')
        ->assertSee('Twelve years building portfolios')
        ->assertSee('BTL')
        ->assertSee('HMO');
});

it('shows published packages with enrol links', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Profile Packages '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@profile-packages.test',
        'plan' => 'starter',
    ]);
    $host = publicMentorHost($tenant);
    $tid = (string) $tenant->getTenantKey();

    tenancy()->initialize($tenant);
    $mentor = makePublishedMentor(['mentor_directory_slug' => 'package-mentor']);
    MentorshipPackage::query()->create([
        'tenant_id' => $tid,
        'mentor_id' => $mentor->id,
        'name' => 'Accelerator Package',
        'slug' => 'accelerator-package',
        'description' => 'Twelve-week intensive.',
        'price_cents' => 250000,
        'currency' => 'GBP',
        'duration_weeks' => 12,
        'billing_cycle' => 'one_off',
        'is_active' => true,
        'is_public' => true,
    ]);
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->get('http://'.$host.'/mentors/package-mentor')
        ->assertOk()
        ->assertSee('Accelerator Package')
        ->assertSee('Twelve-week intensive.')
        ->assertSee('Enrol')
        ->assertSee('/mentoring/apply/accelerator-package');
});

it('shows book-a-session CTA when mentor has an active event type and booking slug', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Profile Book '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@profile-book.test',
        'plan' => 'starter',
    ]);
    $host = publicMentorHost($tenant);

    tenancy()->initialize($tenant);
    $mentor = makePublishedMentor([
        'mentor_directory_slug' => 'book-mentor',
        'booking_public_slug' => 'book-mentor-host',
    ]);
    VcalEventType::query()->create([
        'user_id' => $mentor->id,
        'name' => 'Discovery call',
        'slug' => 'discovery-call',
        'duration_minutes' => 30,
        'is_active' => true,
    ]);
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->get('http://'.$host.'/mentors/book-mentor')
        ->assertOk()
        ->assertSee('Book a session')
        ->assertSee('/book/book-mentor-host');
});

it('does not show book CTA when mentor has no event types', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Profile NoBook '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@profile-nobook.test',
        'plan' => 'starter',
    ]);
    $host = publicMentorHost($tenant);

    tenancy()->initialize($tenant);
    $mentor = makePublishedMentor([
        'mentor_directory_slug' => 'no-book-mentor',
        'booking_public_slug' => 'unused-host',
    ]);
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->get('http://'.$host.'/mentors/no-book-mentor')
        ->assertOk()
        ->assertDontSee('Book a session');
});

it('auto-generates a directory slug on first publish', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Profile Slug '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@profile-slug.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $mentor = User::factory()->create(['name' => 'Jane Mentor', 'email' => 'jane-'.uniqid().'@slug.test']);
    $mentor->assignRole('mentor');
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($mentor, 'web');

    $this->putJson('http://'.publicMentorHost($tenant).'/api/mentoring-os/mentor-profile/'.$mentor->id, [
        'headline' => 'Coach',
        'is_published' => true,
    ])->assertOk();

    tenancy()->initialize($tenant);
    expect($mentor->fresh()->mentor_directory_slug)->toBe('jane-mentor')
        ->and($mentor->fresh()->mentor_directory_opt_in)->toBeTrue();
    tenancy()->end();
});

it('assigns numeric suffix when directory slug collides', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Profile Slug2 '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@profile-slug2.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    TenantRole::query()->firstOrCreate(['name' => 'mentor', 'guard_name' => 'web']);
    $first = makePublishedMentor(['mentor_directory_slug' => 'john-smith']);
    $second = User::factory()->create(['name' => 'John Smith', 'email' => 'john2-'.uniqid().'@slug2.test']);
    $second->assignRole('mentor');
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    tenancy()->initialize($tenant);
    app(MentorProfileService::class)->ensureMentorDirectorySlug($second);
    $second->save();
    expect($second->fresh()->mentor_directory_slug)->toBe('john-smith-2');
    tenancy()->end();
});
