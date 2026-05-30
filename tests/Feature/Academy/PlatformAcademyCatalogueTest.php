<?php

declare(strict_types=1);

use App\Models\Central\Tenant;
use App\Models\Tenant\Course;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use App\Support\Academy\AcademyWorkspace;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
    $this->seed(FeatureFlagSeeder::class);
});

it('shows platform academy courses on a workspace subdomain', function (): void {
    $academy = Tenant::on('central')->where('slug', AcademyWorkspace::slug())->first();
    if ($academy === null) {
        $this->artisan('academy:ensure-workspace')->assertSuccessful();
        $academy = Tenant::on('central')->where('slug', AcademyWorkspace::slug())->firstOrFail();
    }

    $courseName = 'Platform Academy Test '.uniqid();
    $academy->run(function () use ($courseName): void {
        Course::query()->create([
            'name' => $courseName,
            'slug' => 'platform-test-'.uniqid(),
            'description' => 'Visible from any workspace',
            'is_published' => true,
            'status' => 'published',
            'category' => 'General',
            'difficulty' => 'beginner',
            'estimated_minutes' => 30,
        ]);
    });

    $workspace = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Platform Academy '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'pa-'.uniqid().'@test.com',
        'plan' => 'starter',
    ]);
    $host = $workspace->domains->first()->domain.'.propreneur.test';

    $user = null;
    $workspace->run(function () use (&$user): void {
        $user = User::query()->firstOrFail();
    });

    $this->actingAs($user, 'web')
        ->get('http://'.$host.'/platform-academy/learn')
        ->assertOk()
        ->assertSee($courseName, false)
        ->assertSee('Investor education and Propreneur platform training', false)
        ->assertSee('Investor education', false)
        ->assertSee('Platform training', false);
});
