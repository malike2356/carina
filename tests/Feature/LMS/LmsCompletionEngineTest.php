<?php

declare(strict_types=1);

use App\Mail\CommunityLearning\CourseCertificateMail;
use App\Models\Central\FeatureFlag;
use App\Models\Central\Tenant;
use App\Models\Tenant\Course;
use App\Models\Tenant\CourseAssignment;
use App\Models\Tenant\CourseModuleCompletion;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\URL;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'community_learning')->update(['enabled' => true]);
    FeatureFlag::query()->where('key', 'mentoring_os')->update(['enabled' => true]);
    $this->withoutMiddleware(VerifyCsrfToken::class);

    lmsCompletionWorkspace();
});

function lmsCompletionHost(Tenant $tenant): string
{
    return $tenant->domains->first()->domain.'.propreneur.test';
}

/**
 * @return array{tenant: Tenant, host: string}
 */
function lmsCompletionWorkspace(): array
{
    static $tenant = null;
    static $host = null;

    if ($tenant === null) {
        $tenant = app(TenantCreationService::class)->createTenant([
            'company_name' => 'LMS Completion '.uniqid(),
            'owner_name' => 'Owner',
            'owner_email' => 'owner-lms-'.uniqid().'@completion.test',
            'plan' => 'starter',
        ]);
        $tenant->load('domains');
        $host = lmsCompletionHost($tenant);
    }

    return ['tenant' => $tenant, 'host' => $host];
}

/**
 * @return array{course_id: int, module_ids: list<int>}
 */
function lmsPublishCourseWithModules(string $host, int $moduleCount = 2): array
{
    $courseId = test()->postJson("http://{$host}/api/courses", [
        'name' => 'Completion Course '.uniqid('', true),
        'description' => 'Test',
    ])->assertCreated()->json('data.id');

    test()->postJson("http://{$host}/api/courses/{$courseId}/publish")->assertOk();
    test()->postJson("http://{$host}/api/courses/{$courseId}/enroll")->assertCreated();

    $moduleIds = [];
    for ($i = 0; $i < $moduleCount; $i++) {
        $moduleIds[] = (int) test()->postJson("http://{$host}/api/courses/{$courseId}/modules", [
            'title' => 'Module '.$i.' '.uniqid('', true),
            'content' => 'Body',
        ])->assertCreated()->json('data.id');
    }

    return ['course_id' => (int) $courseId, 'module_ids' => $moduleIds];
}

it('marks a module complete and recalculates progress', function (): void {
    ['tenant' => $tenant, 'host' => $host] = lmsCompletionWorkspace();

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($admin, 'web');
    $course = lmsPublishCourseWithModules($host, 2);

    $res = $this->postJson("http://{$host}/api/courses/{$course['course_id']}/modules/{$course['module_ids'][0]}/complete");
    $res->assertOk()
        ->assertJsonPath('progress', 50)
        ->assertJsonPath('completed_modules', 1)
        ->assertJsonPath('total_modules', 2)
        ->assertJsonPath('certified', false);

    tenancy()->initialize($tenant);
    expect(CourseModuleCompletion::query()->where('user_id', $admin->id)->count())->toBe(1);
    tenancy()->end();
});

it('completing all modules sets progress to 100 and issues certificate', function (): void {
    Mail::fake();
    ['tenant' => $tenant, 'host' => $host] = lmsCompletionWorkspace();

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($admin, 'web');
    $course = lmsPublishCourseWithModules($host, 2);

    $this->postJson("http://{$host}/api/courses/{$course['course_id']}/modules/{$course['module_ids'][0]}/complete")->assertOk();
    $res = $this->postJson("http://{$host}/api/courses/{$course['course_id']}/modules/{$course['module_ids'][1]}/complete");

    $res->assertOk()
        ->assertJsonPath('progress', 100)
        ->assertJsonPath('certified', true)
        ->assertJsonStructure(['certificate_url']);

    Mail::assertQueued(CourseCertificateMail::class);

    tenancy()->initialize($tenant);
    $assignment = CourseAssignment::query()
        ->where('user_id', $admin->id)
        ->where('course_id', $course['course_id'])
        ->first();
    expect($assignment)->not->toBeNull()
        ->and((float) $assignment->progress_percent)->toBe(100.0)
        ->and($assignment->certificate_code)->not->toBeNull();
    tenancy()->end();
});

it('module complete is idempotent', function (): void {
    ['tenant' => $tenant, 'host' => $host] = lmsCompletionWorkspace();

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($admin, 'web');
    $course = lmsPublishCourseWithModules($host, 1);
    $url = "http://{$host}/api/courses/{$course['course_id']}/modules/{$course['module_ids'][0]}/complete";

    $this->postJson($url)->assertOk()->assertJsonPath('progress', 100);
    $this->postJson($url)->assertOk()->assertJsonPath('progress', 100);

    tenancy()->initialize($tenant);
    expect(CourseModuleCompletion::query()->where('user_id', $admin->id)->count())->toBe(1);
    tenancy()->end();
});

it('passing a final assessment quiz auto-certifies the course', function (): void {
    Mail::fake();
    ['tenant' => $tenant, 'host' => $host] = lmsCompletionWorkspace();

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($admin, 'web');
    $courseId = $this->postJson("http://{$host}/api/courses", ['name' => 'Final '.uniqid('', true)])->assertCreated()->json('data.id');
    $this->postJson("http://{$host}/api/courses/{$courseId}/publish")->assertOk();
    $this->postJson("http://{$host}/api/courses/{$courseId}/enroll")->assertCreated();

    $quizId = $this->postJson("http://{$host}/api/courses/{$courseId}/quizzes", [
        'title' => 'Final exam',
        'passing_score' => 50,
        'is_final_assessment' => true,
    ])->assertCreated()->json('data.id');

    $qid = $this->postJson("http://{$host}/api/quizzes/{$quizId}/questions", [
        'question' => '2+2?',
        'type' => 'multiple_choice',
        'options' => ['3', '4'],
        'correct_answer' => '1',
        'points' => 10,
    ])->assertCreated()->json('data.id');

    $attemptId = $this->postJson("http://{$host}/api/quizzes/{$quizId}/attempts")->assertCreated()->json('data.id');

    $this->postJson("http://{$host}/api/quiz-attempts/{$attemptId}/submit", [
        'answers' => [(string) $qid => '1'],
    ])->assertOk()
        ->assertJsonPath('certified', true)
        ->assertJsonStructure(['certificate_url']);

    Mail::assertQueued(CourseCertificateMail::class);
});

it('passing a non-final assessment quiz does not auto-certify', function (): void {
    Mail::fake();
    ['tenant' => $tenant, 'host' => $host] = lmsCompletionWorkspace();

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($admin, 'web');
    $courseId = $this->postJson("http://{$host}/api/courses", ['name' => 'Quiz '.uniqid('', true)])->assertCreated()->json('data.id');
    $this->postJson("http://{$host}/api/courses/{$courseId}/publish")->assertOk();
    $this->postJson("http://{$host}/api/courses/{$courseId}/enroll")->assertCreated();

    $quizId = $this->postJson("http://{$host}/api/courses/{$courseId}/quizzes", [
        'title' => 'Practice',
        'passing_score' => 50,
        'is_final_assessment' => false,
    ])->assertCreated()->json('data.id');

    $qid = $this->postJson("http://{$host}/api/quizzes/{$quizId}/questions", [
        'question' => '1+1?',
        'type' => 'multiple_choice',
        'options' => ['1', '2'],
        'correct_answer' => '1',
        'points' => 10,
    ])->assertCreated()->json('data.id');

    $attemptId = $this->postJson("http://{$host}/api/quizzes/{$quizId}/attempts")->assertCreated()->json('data.id');

    $this->postJson("http://{$host}/api/quiz-attempts/{$attemptId}/submit", [
        'answers' => [(string) $qid => '1'],
    ])->assertOk()
        ->assertJsonPath('certified', false)
        ->assertJsonPath('certificate_url', null);

    Mail::assertNothingQueued();
});

it('queues course certificate mail when auto-certified via modules', function (): void {
    Mail::fake();
    ['tenant' => $tenant, 'host' => $host] = lmsCompletionWorkspace();

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($admin, 'web');
    $course = lmsPublishCourseWithModules($host, 1);
    $this->postJson("http://{$host}/api/courses/{$course['course_id']}/modules/{$course['module_ids'][0]}/complete")->assertOk();

    Mail::assertQueued(CourseCertificateMail::class, function (CourseCertificateMail $mail) use ($admin): bool {
        return $mail->hasTo($admin->email);
    });
});

it('shows my learning page with in progress and completed sections', function (): void {
    ['tenant' => $tenant, 'host' => $host] = lmsCompletionWorkspace();

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($admin, 'web');
    $course = lmsPublishCourseWithModules($host, 2);
    $this->postJson("http://{$host}/api/courses/{$course['course_id']}/modules/{$course['module_ids'][0]}/complete")->assertOk();

    $this->get("http://{$host}/lms/my-learning")
        ->assertOk()
        ->assertSee('My Learning')
        ->assertSee('In progress')
        ->assertSee('modules done');
});

it('shows certificate download link on my learning for completed course', function (): void {
    Mail::fake();
    ['tenant' => $tenant, 'host' => $host] = lmsCompletionWorkspace();

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($admin, 'web');
    $course = lmsPublishCourseWithModules($host, 1);
    $this->postJson("http://{$host}/api/courses/{$course['course_id']}/modules/{$course['module_ids'][0]}/complete")->assertOk();

    $this->get("http://{$host}/lms/my-learning")
        ->assertOk()
        ->assertSee('Download certificate');
});

it('allows signed certificate download without authentication', function (): void {
    ['tenant' => $tenant, 'host' => $host] = lmsCompletionWorkspace();

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    $course = Course::query()->create([
        'tenant_id' => (string) $tenant->getTenantKey(),
        'name' => 'Signed cert course',
        'is_published' => true,
    ]);
    $assignment = CourseAssignment::query()->create([
        'user_id' => $admin->id,
        'course_id' => $course->id,
        'enrolled_at' => now(),
        'progress_percent' => 100,
        'completed_at' => now(),
        'certificate_code' => 'CERT-TESTSIGN01',
        'certified_at' => now(),
    ]);
    tenancy()->end();

    $url = URL::temporarySignedRoute(
        'tenant.certificates.signed',
        now()->addDays(7),
        ['assignment' => $assignment->getKey()],
        absolute: false
    );

    $this->get('http://'.$host.$url)->assertOk();
});

it('rejects invalid signed certificate urls', function (): void {
    ['tenant' => $tenant, 'host' => $host] = lmsCompletionWorkspace();

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    $assignment = CourseAssignment::query()->create([
        'user_id' => $admin->id,
        'course_id' => Course::query()->create([
            'tenant_id' => (string) $tenant->getTenantKey(),
            'name' => 'Bad sig',
            'is_published' => true,
        ])->id,
        'enrolled_at' => now(),
        'progress_percent' => 100,
        'completed_at' => now(),
        'certificate_code' => 'CERT-BADSIG01',
        'certified_at' => now(),
    ]);
    tenancy()->end();

    $this->get("http://{$host}/certificates/{$assignment->getKey()}/signed?signature=invalid")->assertForbidden();
});
