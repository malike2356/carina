<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\TenantSetting;
use App\Models\Tenant\TenantRole;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaScheduledAgentService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

describe('carina digest settings', function (): void {
    beforeEach(function (): void {
        $this->seed(FeatureFlagSeeder::class);
        FeatureFlag::syncFromCatalogue();
        FeatureFlag::query()->where('key', 'carina_ai')->update(['enabled' => true, 'tenant_overrides' => null]);

        $this->tenant = app(TenantCreationService::class)->createTenant([
            'company_name' => 'Digest Settings '.uniqid(),
            'owner_name' => 'Owner',
            'owner_email' => 'owner-'.uniqid().'@digest-settings.test',
            'plan' => 'starter',
        ]);

        tenancy()->initialize($this->tenant);

        TenantRole::findOrCreate('tenant_admin', 'web');

        $this->user = User::query()->where('email', $this->tenant->owner_email)->firstOrFail();
        $this->user->syncRoles(['tenant_admin']);
        completeTenantWorkspaceOnboarding();
    });

    afterEach(function (): void {
        if (tenancy()->initialized) {
            tenancy()->end();
        }
    });

    it('shows carina automations page with scheduled briefing toggles', function (): void {
        tenancy()->end();

        $host = actingAsTenant($this->tenant);

        $response = test()->withServerVariables(['HTTP_HOST' => $host])
            ->get(tenantHttpUrl($host, '/carina/coach-settings'));

        $response->assertOk()
            ->assertSee('Carina Automations', false)
            ->assertSee('Scheduled briefings', false)
            ->assertSee('Compliance alerts', false)
            ->assertSee('Pipeline review', false)
            ->assertSee('Accountability coach', false);
    });

    it('defaults compliance urgent on and other digests off', function (): void {
        $tasks = collect(app(CarinaScheduledAgentService::class)->taskList())->keyBy('slug');

        expect($tasks['compliance-urgent-check']['enabled'])->toBeTrue()
            ->and($tasks['compliance-expiry-digest']['enabled'])->toBeFalse()
            ->and($tasks['pipeline-stale-deals']['enabled'])->toBeFalse()
            ->and($tasks['daily-portfolio-summary']['enabled'])->toBeFalse();
    });

    it('saves digest toggles to tenant settings', function (): void {
        tenancy()->end();

        $host = actingAsTenant($this->tenant);

        test()->withServerVariables(['HTTP_HOST' => $host])
            ->withoutMiddleware(VerifyCsrfToken::class)
            ->post(tenantHttpUrl($host, '/carina/digest-settings'), [
                'compliance_urgent' => '1',
                'compliance_expiry' => '0',
                'pipeline_stale' => '1',
                'daily_portfolio' => '0',
                'digest_email' => '0',
            ])
            ->assertRedirect(tenantHttpUrl($host, '/carina/coach-settings'))
            ->assertSessionHas('success');

        tenancy()->initialize($this->tenant);

        expect(TenantSetting::getValue('carina.digest.pipeline_stale'))->toBeTrue()
            ->and(TenantSetting::getValue('carina.digest.compliance_expiry'))->toBeFalse()
            ->and(TenantSetting::getValue('carina.digest.compliance_urgent'))->toBeTrue();

        $tasks = collect(app(CarinaScheduledAgentService::class)->taskList())->keyBy('slug');
        expect($tasks['pipeline-stale-deals']['enabled'])->toBeTrue()
            ->and($tasks['compliance-expiry-digest']['enabled'])->toBeFalse();
    });

    it('saves digest email preference on the user', function (): void {
        tenancy()->end();

        $host = actingAsTenant($this->tenant);

        test()->withServerVariables(['HTTP_HOST' => $host])
            ->withoutMiddleware(VerifyCsrfToken::class)
            ->post(tenantHttpUrl($host, '/carina/digest-settings'), [
                'compliance_urgent' => '1',
                'compliance_expiry' => '0',
                'pipeline_stale' => '0',
                'daily_portfolio' => '0',
                'digest_email' => '1',
            ])
            ->assertRedirect();

        tenancy()->initialize($this->tenant);

        $prefs = $this->user->fresh()->notification_preferences ?? [];
        expect($prefs['carina_digest_email'] ?? false)->toBeTrue();
    });

    it('skips disabled digest tasks when invoked with --task', function (): void {
        $this->artisan('carina:scheduled-agent', [
            '--tenant' => $this->tenant->slug,
            '--task' => 'pipeline-stale-deals',
        ])
            ->expectsOutput("    Task 'pipeline-stale-deals' is disabled - skipping.")
            ->assertExitCode(0);
    });
});
