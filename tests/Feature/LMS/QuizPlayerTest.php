<?php

declare(strict_types=1);

use App\Http\Controllers\Tenant\LmsController;
use App\Models\Central\Domain;
use App\Models\Central\FeatureFlag;
use App\Models\Central\Tenant;
use App\Models\Tenant\Course;
use App\Models\Tenant\CourseAssignment;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use App\Support\TestingCentralCatalog;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Facades\Mail;
use Illuminate\Testing\TestResponse;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'community_learning')->update(['enabled' => true]);
    FeatureFlag::query()->where('key', 'mentoring_os')->update(['enabled' => true]);
    $this->withoutMiddleware(VerifyCsrfToken::class);

    quizPlayerWorkspace();
});

afterEach(function (): void {
    if (tenancy()->initialized) {
        tenancy()->end();
    }

    if (app()->environment('testing')) {
        TestingCentralCatalog::realignCentralConnectionForTesting();
        $name = (string) env('DB_CONNECTION', 'pgsql');
        if ($name !== '' && is_array(config("database.connections.{$name}"))) {
            config(['database.default' => $name]);
            app('db')->setDefaultConnection($name);
        }
    }
});

function quizPlayerHost(Tenant $tenant): string
{
    return $tenant->domains->first()->domain.'.propreneur.test';
}

/**
 * One cold tenant + migrate + bootstrap per file (tenant DB is not transacted with RefreshDatabase).
 *
 * @return array{tenant: Tenant, host: string}
 */
function quizPlayerWorkspace(): array
{
    static $tenant = null;
    static $host = null;

    if ($tenant !== null) {
        TestingCentralCatalog::realignCentralConnectionForTesting();
        $stillExists = Domain::query()
            ->where('tenant_id', $tenant->getTenantKey())
            ->exists();
        if (! $stillExists) {
            $tenant = null;
            $host = null;
        }
    }

    if ($tenant === null) {
        $tenant = app(TenantCreationService::class)->createTenant([
            'company_name' => 'Quiz Player '.uniqid(),
            'owner_name' => 'Owner',
            'owner_email' => 'owner-quiz-'.uniqid().'@player.test',
            'plan' => 'starter',
        ]);
        $tenant->load('domains');
        $host = quizPlayerHost($tenant);
    }

    return ['tenant' => $tenant, 'host' => $host];
}

/**
 * @return array{tenant: Tenant, host: string, admin: User}
 */
function quizPlayerAuthenticate(): array
{
    ['tenant' => $tenant, 'host' => $host] = quizPlayerWorkspace();

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    test()->actingAs($admin, 'web');

    return ['tenant' => $tenant, 'host' => $host, 'admin' => $admin];
}

function quizPlayerUrl(string $host, string $path): string
{
    return tenantHttpUrl($host, $path);
}

function quizPlayerGetJson(string $host, string $path): TestResponse
{
    return test()->withServerVariables(['HTTP_HOST' => $host])
        ->getJson(quizPlayerUrl($host, $path));
}

function quizPlayerPostJson(string $host, string $path, array $data = []): TestResponse
{
    return test()->withServerVariables(['HTTP_HOST' => $host])
        ->postJson(quizPlayerUrl($host, $path), $data);
}

/**
 * @return array{course_id: int, quiz_id: int, question_id: int}
 */
function quizPlayerPublishCourseWithQuiz(string $host, int $maxAttempts = 0, bool $final = false): array
{
    $courseId = (int) quizPlayerPostJson($host, '/api/courses', [
        'name' => 'Quiz Course '.uniqid('', true),
        'description' => 'Test',
    ])->assertCreated()->json('data.id');

    quizPlayerPostJson($host, "/api/courses/{$courseId}/publish")->assertOk();
    quizPlayerPostJson($host, "/api/courses/{$courseId}/enroll")->assertCreated();

    $quizId = (int) quizPlayerPostJson($host, "/api/courses/{$courseId}/quizzes", [
        'title' => 'Knowledge check',
        'passing_score' => 70,
        'max_attempts' => $maxAttempts,
        'is_final_assessment' => $final,
    ])->assertCreated()->json('data.id');

    $questionId = (int) quizPlayerPostJson($host, "/api/quizzes/{$quizId}/questions", [
        'question' => 'Capital of France?',
        'type' => 'multiple_choice',
        'options' => ['London', 'Paris'],
        'correct_answer' => '1',
        'points' => 10,
    ])->assertCreated()->json('data.id');

    return [
        'course_id' => $courseId,
        'quiz_id' => $quizId,
        'question_id' => $questionId,
    ];
}

it('creates a new quiz attempt via POST', function (): void {
    ['host' => $host] = quizPlayerAuthenticate();
    $ctx = quizPlayerPublishCourseWithQuiz($host);

    quizPlayerPostJson($host, "/api/quizzes/{$ctx['quiz_id']}/attempts")
        ->assertCreated()
        ->assertJsonStructure(['data' => ['id', 'quiz_id', 'user_id']]);
});

it('submits an attempt and returns score and passed state', function (): void {
    ['host' => $host] = quizPlayerAuthenticate();
    $ctx = quizPlayerPublishCourseWithQuiz($host);

    $attemptId = quizPlayerPostJson($host, "/api/quizzes/{$ctx['quiz_id']}/attempts")
        ->assertCreated()
        ->json('data.id');

    $response = quizPlayerPostJson($host, "/api/quiz-attempts/{$attemptId}/submit", [
        'answers' => [(string) $ctx['question_id'] => '1'],
    ]);

    $response->assertOk()
        ->assertJsonPath('data.passed', true)
        ->assertJsonStructure(['breakdown', 'passing_score']);

    expect((float) $response->json('data.score'))->toBe(100.0);
});

it('returns 422 when submitting an already completed attempt', function (): void {
    ['host' => $host] = quizPlayerAuthenticate();
    $ctx = quizPlayerPublishCourseWithQuiz($host);

    $attemptId = quizPlayerPostJson($host, "/api/quizzes/{$ctx['quiz_id']}/attempts")->json('data.id');
    $answers = ['answers' => [(string) $ctx['question_id'] => '1']];

    quizPlayerPostJson($host, "/api/quiz-attempts/{$attemptId}/submit", $answers)->assertOk();
    quizPlayerPostJson($host, "/api/quiz-attempts/{$attemptId}/submit", $answers)->assertStatus(422);
});

it('returns 422 when max attempts exceeded', function (): void {
    ['host' => $host] = quizPlayerAuthenticate();
    $ctx = quizPlayerPublishCourseWithQuiz($host, maxAttempts: 1);

    $attemptId = quizPlayerPostJson($host, "/api/quizzes/{$ctx['quiz_id']}/attempts")->json('data.id');
    quizPlayerPostJson($host, "/api/quiz-attempts/{$attemptId}/submit", [
        'answers' => [(string) $ctx['question_id'] => '0'],
    ])->assertOk();

    quizPlayerPostJson($host, "/api/quizzes/{$ctx['quiz_id']}/attempts")->assertStatus(422);
});

it('allows unlimited retakes when max_attempts is zero', function (): void {
    ['host' => $host] = quizPlayerAuthenticate();
    $ctx = quizPlayerPublishCourseWithQuiz($host, maxAttempts: 0);

    for ($i = 0; $i < 3; $i++) {
        $attemptId = quizPlayerPostJson($host, "/api/quizzes/{$ctx['quiz_id']}/attempts")
            ->assertCreated()
            ->json('data.id');
        quizPlayerPostJson($host, "/api/quiz-attempts/{$attemptId}/submit", [
            'answers' => [(string) $ctx['question_id'] => '0'],
        ])->assertOk();
    }
});

it('returns per-question breakdown on review', function (): void {
    ['host' => $host] = quizPlayerAuthenticate();
    $ctx = quizPlayerPublishCourseWithQuiz($host);

    $attemptId = quizPlayerPostJson($host, "/api/quizzes/{$ctx['quiz_id']}/attempts")->json('data.id');
    quizPlayerPostJson($host, "/api/quiz-attempts/{$attemptId}/submit", [
        'answers' => [(string) $ctx['question_id'] => '1'],
    ]);

    quizPlayerGetJson($host, "/api/quiz-attempts/{$attemptId}")
        ->assertOk()
        ->assertJsonStructure([
            'data' => ['id', 'score', 'passed'],
            'breakdown' => [['question_id', 'your_answer', 'correct_answer', 'is_correct']],
        ]);
});

it('passes completed module ids to the course player view', function (): void {
    ['tenant' => $tenant, 'host' => $host] = quizPlayerAuthenticate();
    $courseId = (int) quizPlayerPostJson($host, '/api/courses', [
        'name' => 'View '.uniqid('', true),
        'description' => 'Test',
    ])->assertCreated()->json('data.id');
    quizPlayerPostJson($host, "/api/courses/{$courseId}/publish")->assertOk();
    quizPlayerPostJson($host, "/api/courses/{$courseId}/enroll")->assertCreated();

    $moduleId = (int) quizPlayerPostJson($host, "/api/courses/{$courseId}/modules", [
        'title' => 'Intro',
        'content' => 'Body',
    ])->assertCreated()->json('data.id');

    quizPlayerPostJson($host, "/api/courses/{$courseId}/modules/{$moduleId}/complete")->assertOk();

    tenancy()->initialize($tenant);
    $course = Course::query()->findOrFail($courseId);
    $view = app(LmsController::class)->courseShow($course);
    tenancy()->end();

    expect($view->getData()['completedModuleIds'])->toContain($moduleId);
});

it('passes best quiz attempts keyed by quiz to the course player view', function (): void {
    ['tenant' => $tenant, 'host' => $host] = quizPlayerAuthenticate();
    $ctx = quizPlayerPublishCourseWithQuiz($host);

    $attemptId = quizPlayerPostJson($host, "/api/quizzes/{$ctx['quiz_id']}/attempts")->json('data.id');
    quizPlayerPostJson($host, "/api/quiz-attempts/{$attemptId}/submit", [
        'answers' => [(string) $ctx['question_id'] => '1'],
    ])->assertOk();

    tenancy()->initialize($tenant);
    $course = Course::query()->findOrFail($ctx['course_id']);
    $view = app(LmsController::class)->courseShow($course);
    tenancy()->end();

    $attempts = $view->getData()['quizAttempts'];
    expect($attempts->has($ctx['quiz_id']))->toBeTrue()
        ->and((float) $attempts->get($ctx['quiz_id'])->score)->toBe(100.0);
});

it('auto-certifies when final assessment is passed', function (): void {
    Mail::fake();
    ['tenant' => $tenant, 'host' => $host, 'admin' => $admin] = quizPlayerAuthenticate();
    $ctx = quizPlayerPublishCourseWithQuiz($host, final: true);

    $attemptId = quizPlayerPostJson($host, "/api/quizzes/{$ctx['quiz_id']}/attempts")->json('data.id');

    quizPlayerPostJson($host, "/api/quiz-attempts/{$attemptId}/submit", [
        'answers' => [(string) $ctx['question_id'] => '1'],
    ])
        ->assertOk()
        ->assertJsonPath('certified', true)
        ->assertJsonStructure(['certificate_url']);

    tenancy()->initialize($tenant);
    $assignment = CourseAssignment::query()
        ->where('user_id', $admin->id)
        ->where('course_id', $ctx['course_id'])
        ->first();
    expect($assignment?->certified_at)->not->toBeNull();
    tenancy()->end();
});
