<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\CarinaScheduledRun;
use App\Models\Tenant\TenantRole;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaScheduledAgentService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Carbon;

describe('accountability coach opt-in', function (): void {
    beforeEach(function (): void {
        $this->seed(FeatureFlagSeeder::class);
        FeatureFlag::syncFromCatalogue();
        FeatureFlag::query()->where('key', 'carina_ai')->update(['enabled' => true, 'tenant_overrides' => null]);

        $this->tenant = app(TenantCreationService::class)->createTenant([
            'company_name' => 'Coach Opt-In '.uniqid(),
            'owner_name' => 'Owner',
            'owner_email' => 'owner-'.uniqid().'@coach-opt-in.test',
            'plan' => 'starter',
        ]);

        tenancy()->initialize($this->tenant);

        TenantRole::findOrCreate('tenant_admin', 'web');

        $this->user = User::query()->where('email', $this->tenant->owner_email)->firstOrFail();
        $this->user->syncRoles(['tenant_admin']);
        completeTenantWorkspaceOnboarding();
    });

    afterEach(function (): void {
        Carbon::setTestNow();
        if (tenancy()->initialized) {
            tenancy()->end();
        }
    });

    it('skips disabled coach tasks when invoked with --task', function (): void {
        $this->artisan('carina:scheduled-agent', [
            '--tenant' => $this->tenant->slug,
            '--task' => 'accountability-coach-morning',
        ])
            ->expectsOutput("    Task 'accountability-coach-morning' is disabled - skipping.")
            ->assertExitCode(0);

        tenancy()->initialize($this->tenant);

        expect(CarinaScheduledRun::query()->where('task_slug', 'accountability-coach-morning')->exists())->toBeFalse();
    });

    it('does not run coach for tenants without opted-in users', function (): void {
        Carbon::setTestNow(Carbon::parse('2026-06-14 07:00:00', config('app.timezone')));

        $this->artisan('carina:run-opted-in-coach')
            ->assertExitCode(0);

        tenancy()->initialize($this->tenant);

        expect(CarinaScheduledRun::query()->where('task_slug', 'accountability-coach-morning')->exists())->toBeFalse();
    });

    it('runs coach for opted-in users when a coach task is selected', function (): void {
        $this->user->update(['coach_enabled' => true]);

        $coachTask = collect(app(CarinaScheduledAgentService::class)->taskList())
            ->firstWhere('slug', 'accountability-coach-morning');

        $mockService = Mockery::mock(CarinaScheduledAgentService::class);
        $mockService->shouldReceive('taskList')->once()->andReturn([$coachTask]);
        $mockService->shouldReceive('runTask')
            ->once()
            ->with($coachTask, Mockery::on(fn (User $user): bool => (int) $user->id === (int) $this->user->id))
            ->andReturn('Morning check-in complete.');

        $this->swap(CarinaScheduledAgentService::class, $mockService);

        $this->artisan('carina:run-opted-in-coach', [
            '--task' => 'accountability-coach-morning',
        ])->assertExitCode(0);
    });

    it('updates coach opt-in via patch endpoint', function (): void {
        tenancy()->end();

        $host = actingAsTenant($this->tenant);

        $response = test()->withServerVariables(['HTTP_HOST' => $host])
            ->withoutMiddleware(VerifyCsrfToken::class)
            ->patchJson(tenantHttpUrl($host, '/carina/coach-opt-in'), [
                'enabled' => true,
            ]);

        $response->assertOk()
            ->assertJson([
                'ok' => true,
                'coach_enabled' => true,
            ]);

        tenancy()->initialize($this->tenant);
        expect($this->user->fresh()->coach_enabled)->toBeTrue();
    });
});
