<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\Tenant;
use App\Models\Tenant\CommunityPost;
use App\Models\Tenant\Course;
use App\Models\Tenant\GroupEvent;
use App\Models\Tenant\MentorshipRelationship;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Facades\Hash;

beforeEach(function (): void {
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'community_learning')->update(['enabled' => true]);
    FeatureFlag::query()->where('key', 'carina_ai')->update(['enabled' => false]);

    clModuleWorkspace();
});

function clTenantHost(Tenant $tenant): string
{
    return $tenant->domains->first()->domain.'.propreneur.test';
}

/**
 * One cold tenant + migrate + bootstrap per file (tenant DB is not transacted with RefreshDatabase).
 * Use uniqid-scoped names in tests to avoid collisions across it() blocks.
 *
 * @return array{tenant: Tenant, host: string}
 */
function clModuleWorkspace(): array
{
    static $tenant = null;
    static $host = null;

    if ($tenant === null) {
        $tenant = app(TenantCreationService::class)->createTenant([
            'company_name' => 'CL Module Shared '.uniqid(),
            'owner_name' => 'Owner',
            'owner_email' => 'owner-cl-module-'.uniqid().'@shared.test',
            'plan' => 'starter',
        ]);
        $tenant->load('domains');
        $host = clTenantHost($tenant);
    }

    return ['tenant' => $tenant, 'host' => $host];
}

it('creates lists searches likes and comments posts', function (): void {
    ['tenant' => $tenant, 'host' => $host] = clModuleWorkspace();

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    $member = User::factory()->create([
        'email' => 'member-'.uniqid('', true).'@cl-posts.test',
        'password' => Hash::make('secret'),
    ]);
    tenancy()->end();

    $this->actingAs($admin, 'web');

    $this->get("http://{$host}/community")->assertOk();

    $suffix = uniqid('', true);
    $create = $this->postJson("http://{$host}/api/community/posts", [
        'title' => 'Hello '.$suffix,
        'content' => 'World discussion '.$suffix,
        'tags' => ['deals'],
    ]);
    $create->assertCreated();
    $postId = $create->json('data.id');

    $this->getJson('http://'.$host.'/api/community/posts?search='.rawurlencode('World discussion '.$suffix))->assertOk()
        ->assertJsonPath('data.0.id', $postId);

    $this->postJson("http://{$host}/api/community/posts/{$postId}/like")->assertOk();
    $this->postJson("http://{$host}/api/community/posts/{$postId}/comments", [
        'content' => 'Nice post',
    ])->assertCreated();

    $this->actingAs($member, 'web');
    $this->postJson("http://{$host}/api/community/posts/{$postId}/like")->assertOk();

    $this->actingAs($admin, 'web');
    $this->deleteJson("http://{$host}/api/community/posts/{$postId}/like")->assertOk();

    expect(CommunityPost::query()->find($postId)->likes_count)->toBeGreaterThanOrEqual(0);
});

it('manages groups events join attend and courses enrollment progress certify', function (): void {
    ['tenant' => $tenant, 'host' => $host] = clModuleWorkspace();

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($admin, 'web');

    $g = $this->postJson("http://{$host}/api/groups", [
        'name' => 'Investors '.uniqid('', true),
        'description' => 'Peer group',
        'is_private' => false,
    ])->assertCreated()->json('data.id');

    $this->postJson("http://{$host}/api/groups/{$g}/events", [
        'title' => 'Meetup '.uniqid('', true),
        'starts_at' => now()->addDay()->toIso8601String(),
    ])->assertCreated();
    $eventId = GroupEvent::query()->where('group_id', $g)->value('id');

    $this->postJson("http://{$host}/api/groups/{$g}/events/{$eventId}/attend")->assertOk();

    $course = $this->postJson("http://{$host}/api/courses", [
        'name' => 'Intro '.uniqid('', true),
        'description' => 'Basics',
    ])->assertCreated()->json('data.id');

    $this->postJson("http://{$host}/api/courses/{$course}/publish")->assertOk();

    $this->postJson("http://{$host}/api/courses/{$course}/modules", [
        'title' => 'Mod A '.uniqid('', true),
        'content' => 'Body',
    ])->assertCreated();

    $this->postJson("http://{$host}/api/courses/{$course}/enroll")->assertCreated();
    $this->postJson("http://{$host}/api/courses/{$course}/progress", [
        'progress_percent' => 100,
    ])->assertOk();
    $this->getJson("http://{$host}/api/courses/{$course}/progress")->assertOk()
        ->assertJsonPath('data.progress_percent', 100);

    $this->postJson("http://{$host}/api/courses/{$course}/certify")->assertOk()
        ->assertJsonStructure(['data' => ['certificate_code']]);

    expect(Course::query()->find($course)->is_published)->toBeTrue();
});

it('runs quizzes learning paths mentorship and badges', function (): void {
    ['tenant' => $tenant, 'host' => $host] = clModuleWorkspace();

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    $mentor = User::factory()->create(['email' => 'm-'.uniqid('', true).'@cl-extra.test', 'password' => Hash::make('secret')]);
    $mentee = User::factory()->create(['email' => 'e-'.uniqid('', true).'@cl-extra.test', 'password' => Hash::make('secret')]);
    tenancy()->end();

    $this->actingAs($admin, 'web');

    $c1 = $this->postJson("http://{$host}/api/courses", ['name' => 'C1 '.uniqid('', true)])->assertCreated()->json('data.id');
    $c2 = $this->postJson("http://{$host}/api/courses", ['name' => 'C2 '.uniqid('', true)])->assertCreated()->json('data.id');
    $this->postJson("http://{$host}/api/courses/{$c1}/publish")->assertOk();
    $this->postJson("http://{$host}/api/courses/{$c2}/publish")->assertOk();

    $q = $this->postJson("http://{$host}/api/courses/{$c1}/quizzes", [
        'title' => 'Q1 '.uniqid('', true),
        'passing_score' => 50,
    ])->assertCreated()->json('data.id');

    $qid = $this->postJson("http://{$host}/api/quizzes/{$q}/questions", [
        'question' => '2+2?',
        'type' => 'multiple_choice',
        'options' => ['3', '4', '5'],
        'correct_answer' => '1',
        'points' => 10,
    ])->assertCreated()->json('data.id');

    $start = $this->postJson("http://{$host}/api/quizzes/{$q}/attempts")->assertCreated();
    $attemptId = $start->json('data.id');

    $this->postJson("http://{$host}/api/quiz-attempts/{$attemptId}/submit", [
        'answers' => [(string) $qid => '1'],
    ])->assertOk()->assertJsonPath('data.passed', true);

    $path = $this->postJson('http://'.$host.'/api/learning-paths', [
        'name' => 'Path '.uniqid('', true),
        'courses' => [(int) $c1, (int) $c2],
    ])->assertCreated()->json('data.id');

    $this->postJson("http://{$host}/api/learning-paths/{$path}/publish")->assertOk();
    $this->postJson("http://{$host}/api/learning-paths/{$path}/assign", [])->assertCreated();

    $this->postJson('http://'.$host.'/api/mentorships', [
        'mentor_id' => $mentor->id,
        'mentee_id' => $mentee->id,
        'status' => 'active',
    ])->assertCreated();

    $relId = MentorshipRelationship::query()->orderByDesc('id')->value('id');
    $this->actingAs($mentor, 'web');
    $this->postJson("http://{$host}/api/mentorships/{$relId}/messages", [
        'message' => 'Welcome',
    ])->assertCreated();

    $this->actingAs($admin, 'web');
    $badge = $this->postJson('http://'.$host.'/api/badges', [
        'name' => 'Graduate '.uniqid('', true),
        'criteria' => ['type' => 'course_complete', 'course_id' => $c1],
    ])->assertCreated()->json('data.id');

    $this->postJson("http://{$host}/api/badges/{$badge}/award", [
        'user_id' => $admin->id,
        'check_criteria' => false,
    ])->assertCreated();

    $this->getJson("http://{$host}/api/badges/my")->assertOk();
    $this->getJson("http://{$host}/api/achievements/progress")->assertOk();
});

it('threads comments and polishes drafts with Carina when enabled', function (): void {
    FeatureFlag::query()->where('key', 'carina_ai')->update(['enabled' => true]);

    ['tenant' => $tenant, 'host' => $host] = clModuleWorkspace();

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($admin, 'web');

    $postId = $this->postJson("http://{$host}/api/community/posts", [
        'title' => 'Threaded '.uniqid('', true),
        'content' => 'Root post',
    ])->assertCreated()->json('data.id');

    $c1 = $this->postJson("http://{$host}/api/community/posts/{$postId}/comments", [
        'content' => 'First reply',
    ])->assertCreated()->json('data.id');

    $c2 = $this->postJson("http://{$host}/api/community/posts/{$postId}/comments", [
        'content' => 'Nested',
        'parent_id' => $c1,
    ])->assertCreated()->json('data.id');

    $tree = $this->getJson("http://{$host}/api/community/posts/{$postId}/comments")->assertOk()->json('data');
    expect($tree)->toBeArray()->and($tree)->not->toBeEmpty();
    expect($tree[0]['replies'][0]['id'])->toBe($c2);

    $mock = Mockery::mock(CarinaService::class);
    $mock->shouldReceive('complete')->once()->andReturn('Polished body.');
    $this->instance(CarinaService::class, $mock);

    $this->postJson("http://{$host}/api/community/draft-polish", [
        'text' => 'rough draft',
        'mode' => 'rewrite',
    ])->assertOk()->assertJsonPath('text', 'Polished body.');

    Mockery::close();
});

it('returns 404 when community_learning feature is disabled', function (): void {
    FeatureFlag::query()->where('key', 'community_learning')->update(['enabled' => false]);

    ['tenant' => $tenant, 'host' => $host] = clModuleWorkspace();

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($admin, 'web');
    $this->getJson("http://{$host}/api/community/posts")->assertNotFound();
    $this->get("http://{$host}/community")->assertNotFound();
});
