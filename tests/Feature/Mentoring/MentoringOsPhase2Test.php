<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\Tenant;
use App\Models\Tenant\MentorProfile;
use App\Models\Tenant\MentorshipGoal;
use App\Models\Tenant\MentorshipMilestone;
use App\Models\Tenant\MentorshipRelationship;
use App\Models\Tenant\MentorshipSessionNote;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Database\Seeders\Central\SubscriptionPlanSeeder;
use Illuminate\Support\Facades\Hash;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    $this->seed(SubscriptionPlanSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'community_learning')->update(['enabled' => true]);
    FeatureFlag::query()->where('key', 'mentoring_os')->update(['enabled' => true]);
    FeatureFlag::query()->where('key', 'carina_ai')->update(['enabled' => false]);
});

function mentoringPhase2Host(Tenant $tenant): string
{
    return $tenant->domains->first()->domain.'.propreneur.test';
}

/**
 * @return array{tenant: Tenant, host: string, admin: User, mentor: User, mentee: User, mentorship: MentorshipRelationship}
 */
function makeMentoringWorkspace(string $companyPrefix): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => $companyPrefix.' '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@p2.test',
        'plan' => 'starter',
    ]);
    $host = mentoringPhase2Host($tenant);

    tenancy()->initialize($tenant);
    completeTenantWorkspaceOnboarding();
    $admin = User::query()->firstOrFail();

    $mentor = User::factory()->create([
        'email' => 'mentor-'.uniqid().'@p2.test',
        'password' => Hash::make('secret'),
    ]);
    $mentor->assignRole('mentor');

    $mentee = User::factory()->create([
        'email' => 'mentee-'.uniqid().'@p2.test',
        'password' => Hash::make('secret'),
    ]);
    $mentee->assignRole('mentee');

    $mentorship = MentorshipRelationship::query()->create([
        'tenant_id' => (string) $tenant->getTenantKey(),
        'mentor_id' => $mentor->id,
        'mentee_id' => $mentee->id,
        'status' => 'active',
        'started_at' => now(),
    ]);

    tenancy()->end();

    return [
        'tenant' => $tenant,
        'host' => $host,
        'admin' => $admin,
        'mentor' => $mentor,
        'mentee' => $mentee,
        'mentorship' => $mentorship,
    ];
}

it('lets a mentor create, update, and delete a goal for their mentorship', function (): void {
    [$tenant, $host, $admin, $mentor, $mentee, $mentorship] = array_values(makeMentoringWorkspace('Goals'));

    $this->actingAs($mentor, 'web');

    $create = $this->postJson('http://'.$host.'/api/mentoring-os/mentorships/'.$mentorship->id.'/goals', [
        'title' => 'Buy first BRR property',
        'description' => 'Find, fund, refurb',
        'target_date' => now()->addMonth()->toDateString(),
        'progress_percent' => 10,
    ]);
    $create->assertCreated();
    $goalId = (int) $create->json('data.id');
    expect($goalId)->toBeGreaterThan(0);

    $list = $this->getJson('http://'.$host.'/api/mentoring-os/mentorships/'.$mentorship->id.'/goals');
    $list->assertOk();
    expect($list->json('data'))->toHaveCount(1);

    $upd = $this->putJson('http://'.$host.'/api/mentoring-os/mentorships/'.$mentorship->id.'/goals/'.$goalId, [
        'status' => 'in_progress',
        'progress_percent' => 50,
    ]);
    $upd->assertOk();
    expect($upd->json('data.status'))->toBe('in_progress')
        ->and((int) $upd->json('data.progress_percent'))->toBe(50);

    $del = $this->deleteJson('http://'.$host.'/api/mentoring-os/mentorships/'.$mentorship->id.'/goals/'.$goalId);
    $del->assertNoContent();

    tenancy()->initialize($tenant);
    expect(MentorshipGoal::query()->count())->toBe(0);
    tenancy()->end();
});

it('forbids a stranger from creating a goal on a mentorship they are not part of', function (): void {
    [$tenant, $host, $admin, $mentor, $mentee, $mentorship] = array_values(makeMentoringWorkspace('GoalsDeny'));

    tenancy()->initialize($tenant);
    $stranger = User::factory()->create([
        'email' => 'stranger-'.uniqid().'@p2.test',
        'password' => Hash::make('secret'),
    ]);
    $stranger->assignRole('mentor');
    tenancy()->end();

    $this->actingAs($stranger, 'web');
    $this->postJson('http://'.$host.'/api/mentoring-os/mentorships/'.$mentorship->id.'/goals', [
        'title' => 'Not mine',
    ])->assertForbidden();
});

it('lets a mentor add, complete, and delete a milestone', function (): void {
    [$tenant, $host, , $mentor, , $mentorship] = array_values(makeMentoringWorkspace('Milestones'));

    $this->actingAs($mentor, 'web');

    $create = $this->postJson('http://'.$host.'/api/mentoring-os/mentorships/'.$mentorship->id.'/milestones', [
        'title' => 'Pre-approval done',
        'due_date' => now()->addWeek()->toDateString(),
    ]);
    $create->assertCreated();
    $id = (int) $create->json('data.id');

    $done = $this->postJson('http://'.$host.'/api/mentoring-os/mentorships/'.$mentorship->id.'/milestones/'.$id.'/complete', [
        'done' => true,
    ]);
    $done->assertOk();
    expect($done->json('data.completed_at'))->not->toBeNull();

    $undone = $this->postJson('http://'.$host.'/api/mentoring-os/mentorships/'.$mentorship->id.'/milestones/'.$id.'/complete', [
        'done' => false,
    ]);
    $undone->assertOk();
    expect($undone->json('data.completed_at'))->toBeNull();

    $del = $this->deleteJson('http://'.$host.'/api/mentoring-os/mentorships/'.$mentorship->id.'/milestones/'.$id);
    $del->assertNoContent();

    tenancy()->initialize($tenant);
    expect(MentorshipMilestone::query()->count())->toBe(0);
    tenancy()->end();
});

it('creates a session note, exposes shared notes to the mentee, and hides mentor-only notes', function (): void {
    [$tenant, $host, , $mentor, $mentee, $mentorship] = array_values(makeMentoringWorkspace('Notes'));

    $this->actingAs($mentor, 'web');

    $this->postJson('http://'.$host.'/api/mentoring-os/mentorships/'.$mentorship->id.'/session-notes', [
        'summary' => 'Shared note',
        'visibility' => 'shared',
        'action_items' => [['text' => 'Send leases', 'done' => false]],
    ])->assertCreated();

    $this->postJson('http://'.$host.'/api/mentoring-os/mentorships/'.$mentorship->id.'/session-notes', [
        'summary' => 'Mentor-only critique',
        'visibility' => 'mentor_only',
    ])->assertCreated();

    $mentorList = $this->getJson('http://'.$host.'/api/mentoring-os/mentorships/'.$mentorship->id.'/session-notes');
    $mentorList->assertOk();
    expect($mentorList->json('data'))->toHaveCount(2);

    $this->actingAs($mentee, 'web');
    $menteeList = $this->getJson('http://'.$host.'/api/mentoring-os/mentorships/'.$mentorship->id.'/session-notes');
    $menteeList->assertOk();
    expect($menteeList->json('data'))->toHaveCount(1)
        ->and($menteeList->json('data.0.summary'))->toBe('Shared note');

    tenancy()->initialize($tenant);
    expect(MentorshipSessionNote::query()->count())->toBe(2);
    tenancy()->end();
});

it('creates a mentorship package, lists it, and prevents deletion when attached to a relationship', function (): void {
    [$tenant, $host, $admin, $mentor, , $mentorship] = array_values(makeMentoringWorkspace('Packages'));

    $this->actingAs($admin, 'web');

    $created = $this->postJson('http://'.$host.'/api/mentoring-os/packages', [
        'name' => 'Growth Package',
        'price_cents' => 99000,
        'currency' => 'GBP',
        'sessions_included' => 6,
        'duration_weeks' => 12,
        'billing_cycle' => 'one_time',
        'inclusions' => ['Calls', 'Slack'],
        'is_active' => true,
    ]);
    $created->assertCreated();
    $packageId = (int) $created->json('data.id');

    $this->getJson('http://'.$host.'/api/mentoring-os/packages')
        ->assertOk()
        ->assertJsonPath('data.0.name', 'Growth Package');

    tenancy()->initialize($tenant);
    $mentorship->update(['mentorship_package_id' => $packageId]);
    tenancy()->end();

    $this->deleteJson('http://'.$host.'/api/mentoring-os/packages/'.$packageId)
        ->assertStatus(422);
});

it('updates and unpublishes a mentor profile, mirroring directory opt-in', function (): void {
    [$tenant, $host, , $mentor] = array_values(makeMentoringWorkspace('Profiles'));

    $this->actingAs($mentor, 'web');

    $upd = $this->putJson('http://'.$host.'/api/mentoring-os/mentor-profile/'.$mentor->id, [
        'headline' => 'BRR mentor',
        'bio' => 'I help operators do their first BRR.',
        'specialties' => ['BRR', 'Refurbs'],
        'hourly_rate_cents' => 12500,
        'currency' => 'GBP',
        'is_published' => true,
        'accepting_new_mentees' => true,
    ]);
    $upd->assertOk();
    expect($upd->json('data.headline'))->toBe('BRR mentor')
        ->and((bool) $upd->json('data.is_published'))->toBeTrue();

    $unp = $this->postJson('http://'.$host.'/api/mentoring-os/mentor-profile/'.$mentor->id.'/unpublish');
    $unp->assertNoContent();

    tenancy()->initialize($tenant);
    $profile = MentorProfile::query()->where('user_id', $mentor->id)->firstOrFail();
    expect($profile->is_published)->toBeFalse();
    tenancy()->end();
});

it('returns a workspace reports summary', function (): void {
    [$tenant, $host, $admin] = array_values(makeMentoringWorkspace('Reports'));

    $this->actingAs($admin, 'web');

    $res = $this->getJson('http://'.$host.'/api/mentoring-os/reports/summary');
    $res->assertOk();
    expect($res->json('data.totals'))->toBeArray()
        ->and($res->json('data.sessions'))->toBeArray()
        ->and($res->json('data.goals'))->toBeArray()
        ->and($res->json('data.milestones'))->toBeArray();
});

it('renders the mentorship relationship detail page for the mentor', function (): void {
    [$tenant, $host, , $mentor, , $mentorship] = array_values(makeMentoringWorkspace('Detail'));

    $this->actingAs($mentor, 'web');

    $this->get('http://'.$host.'/mentoring/relationships/'.$mentorship->id)
        ->assertOk()
        ->assertSee('Goals')
        ->assertSee('Milestones')
        ->assertSee('Session notes');
});

it('forbids a stranger from viewing a mentorship detail page', function (): void {
    [$tenant, $host, , , , $mentorship] = array_values(makeMentoringWorkspace('DetailDeny'));

    tenancy()->initialize($tenant);
    $stranger = User::factory()->create([
        'email' => 'detail-stranger-'.uniqid().'@p2.test',
        'password' => Hash::make('secret'),
    ]);
    $stranger->assignRole('mentor');
    tenancy()->end();

    $this->actingAs($stranger, 'web');
    $this->get('http://'.$host.'/mentoring/relationships/'.$mentorship->id)
        ->assertForbidden();
});

it('exposes the mentor directory to mentor/mentee/admin and lists mentors', function (): void {
    [$tenant, $host, $admin, $mentor] = array_values(makeMentoringWorkspace('Directory'));

    $this->actingAs($admin, 'web');
    $this->get('http://'.$host.'/mentoring/directory')
        ->assertOk()
        ->assertSee($mentor->name);
});

it('renders the packages and reports admin views', function (): void {
    [$tenant, $host, $admin] = array_values(makeMentoringWorkspace('AdminViews'));

    $this->actingAs($admin, 'web');
    $this->get('http://'.$host.'/mentoring/packages')->assertOk();
    $this->get('http://'.$host.'/mentoring/reports')->assertOk();
    $this->get('http://'.$host.'/mentoring/profile')->assertOk();
});
