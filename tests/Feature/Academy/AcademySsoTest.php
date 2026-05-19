<?php

declare(strict_types=1);

use App\Models\Central\Tenant;
use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\Course;
use App\Models\Tenant\CourseAssignment;
use App\Models\Tenant\CourseModule;
use App\Models\Tenant\User;
use App\Services\Academy\AcademySsoService;
use App\Services\Tenancy\TenantCreationService;
use App\Support\Academy\AcademyWorkspace;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

function academyHost(Tenant $tenant): string
{
    return AcademyWorkspace::PUBLIC_SUBDOMAIN.'.propreneur.test';
}

it('returns academy redirect url for authenticated tenant user', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'SSO API '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'sso-api-'.uniqid().'@test.com',
        'plan' => 'starter',
    ]);
    $host = academyHost($tenant);

    $user = null;
    $tenant->run(function () use (&$user): void {
        $user = User::query()->firstOrFail();
    });

    $this->actingAs($user, 'web')
        ->getJson("http://{$host}/api/academy/sso-token")
        ->assertOk()
        ->assertJsonStructure(['redirect_url'])
        ->assertJsonPath('redirect_url', function ($url): bool {
            $url = (string) $url;

            return parse_url($url, PHP_URL_HOST) === 'academy.propreneur.test'
                && str_contains($url, 'sso/callback');
        });
});

it('provisions user on sso callback', function (): void {
    $academy = Tenant::on('central')->where('slug', AcademyWorkspace::SLUG)->first();
    if ($academy === null) {
        $this->artisan('academy:ensure-workspace')->assertSuccessful();
        $academy = Tenant::on('central')->where('slug', AcademyWorkspace::SLUG)->firstOrFail();
    }

    $source = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Callback Src '.uniqid(),
        'owner_name' => 'Learner',
        'owner_email' => 'callback-'.uniqid().'@academy.test',
        'plan' => 'starter',
    ]);

    $token = null;
    $source->run(function () use ($source, &$token): void {
        $user = User::query()->firstOrFail();
        $token = app(AcademySsoService::class)->generateToken($user, $source);
    });

    $host = academyHost($academy);
    $this->get("http://{$host}/sso/callback?token=".urlencode((string) $token))
        ->assertRedirect(route('academy.catalogue', [], false))
        ->assertSessionHas('academy.source_workspace', $source->slug);

    $academy->run(function () use ($source): void {
        expect(User::query()->where('email', $source->owner_email)->exists())->toBeTrue();
    });
});

it('enrolls a learner in an academy course via slug route', function (): void {
    $academy = Tenant::on('central')->where('slug', AcademyWorkspace::SLUG)->first();
    if ($academy === null) {
        $this->artisan('academy:ensure-workspace')->assertSuccessful();
        $academy = Tenant::on('central')->where('slug', AcademyWorkspace::SLUG)->firstOrFail();
    }

    $course = null;
    $user = null;
    $academy->run(function () use (&$course, &$user): void {
        $user = User::factory()->create();
        $course = Course::query()->create([
            'tenant_id' => tenant()->getTenantKey(),
            'name' => 'Slug Enroll Test',
            'slug' => 'slug-enroll-test',
            'is_published' => true,
            'status' => 'published',
        ]);
    });
    /** @var Course $course */
    /** @var User $user */
    $this->actingAs($user, 'web')
        ->post('http://'.academyHost($academy).'/learn/'.$course->slug.'/enroll', [
            '_token' => csrf_token(),
        ])
        ->assertRedirect();

    $academy->run(function () use ($course, $user): void {
        expect(CourseAssignment::query()
            ->where('course_id', $course->id)
            ->where('user_id', $user->id)
            ->exists())->toBeTrue();
    });
});

it('renders academy courses as progressive lesson steps', function (): void {
    $academy = Tenant::on('central')->where('slug', AcademyWorkspace::SLUG)->first();
    if ($academy === null) {
        $this->artisan('academy:ensure-workspace')->assertSuccessful();
        $academy = Tenant::on('central')->where('slug', AcademyWorkspace::SLUG)->firstOrFail();
    }

    $course = null;
    $user = null;
    $academy->run(function () use (&$course, &$user): void {
        $user = User::factory()->create();
        $course = Course::query()->create([
            'tenant_id' => tenant()->getTenantKey(),
            'name' => 'Progressive Lesson Test',
            'slug' => 'progressive-lesson-test',
            'is_published' => true,
            'status' => 'published',
        ]);
        CourseModule::query()->create([
            'course_id' => $course->id,
            'title' => 'Foundations',
            'content' => "# First idea\n\nThis is **not** a newspaper article. It is a short coached learning step.\n\n## Second idea\n\nRead this, then move to the next lesson step.",
            'sort_order' => 1,
        ]);
        CourseAssignment::query()->create([
            'user_id' => $user->id,
            'course_id' => $course->id,
            'enrolled_at' => now(),
            'progress_percent' => 0,
        ]);
    });
    /** @var Course $course */
    /** @var User $user */
    $this->actingAs($user, 'web')
        ->get('http://'.academyHost($academy).'/learn/'.$course->slug)
        ->assertOk()
        ->assertSee('Lesson step', false)
        ->assertSee('Continue lesson', false)
        ->assertSee('Carina tutor', false)
        ->assertSee('Explain this lesson', false)
        ->assertSee('Quiz me', false)
        ->assertDontSee('# First idea', false)
        ->assertDontSee('**not**', false);
});

it('shows only academy learning navigation in the academy workspace', function (): void {
    $academy = Tenant::on('central')->where('slug', AcademyWorkspace::SLUG)->first();
    if ($academy === null) {
        $this->artisan('academy:ensure-workspace')->assertSuccessful();
        $academy = Tenant::on('central')->where('slug', AcademyWorkspace::SLUG)->firstOrFail();
    }

    $user = null;
    $academy->run(function () use (&$user): void {
        $user = User::factory()->create();
    });
    /** @var User $user */
    $this->actingAs($user, 'web')
        ->withSession(['academy.source_workspace' => 'xelox'])
        ->get('http://'.academyHost($academy).'/learn')
        ->assertOk()
        ->assertSee('Back to workspace', false)
        ->assertSee('http://xelox.propreneur.test/', false)
        ->assertSee('Course catalogue', false)
        ->assertSee('Certificates', false)
        ->assertDontSee('Deals', false)
        ->assertDontSee('Portfolio', false)
        ->assertDontSee('Accounting', false)
        ->assertDontSee('Find & Analyse', false)
        ->assertDontSee('Manage Assets', false);
});

it('opens carina in academy teaching mode for a course', function (): void {
    $academy = Tenant::on('central')->where('slug', AcademyWorkspace::SLUG)->first();
    if ($academy === null) {
        $this->artisan('academy:ensure-workspace')->assertSuccessful();
        $academy = Tenant::on('central')->where('slug', AcademyWorkspace::SLUG)->firstOrFail();
    }

    $course = null;
    $user = null;
    $academy->run(function () use (&$course, &$user): void {
        $user = User::factory()->create();
        $course = Course::query()->create([
            'tenant_id' => tenant()->getTenantKey(),
            'name' => 'Carina Tutor Test',
            'slug' => 'carina-tutor-test',
            'is_published' => true,
            'status' => 'published',
        ]);
    });
    /** @var Course $course */
    /** @var User $user */
    $this->actingAs($user, 'web')
        ->get('http://'.academyHost($academy).'/carina/open-course/'.$course->id)
        ->assertRedirect();

    $academy->run(function () use ($course, $user): void {
        $conversation = CarinaConversation::query()
            ->where('user_id', $user->id)
            ->where('context_type', 'course')
            ->where('context_id', $course->id)
            ->latest('id')
            ->firstOrFail();

        expect((int) $conversation->course_id)->toBe((int) $course->id);
        expect($conversation->academy_session_mode)->toBe('teaching');
    });
});
