<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\Tenant;
use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaBaselineContextService;
use App\Services\Carina\CarinaService;
use App\Services\Carina\WorkspaceContextService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
});

/**
 * @return array{0: Tenant, 1: User}
 */
function workspaceContextTenant(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Workspace Context '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@workspace-context.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    return [$tenant, $user];
}

afterEach(function (): void {
    if (isset($this->workspaceCleanupDir) && is_string($this->workspaceCleanupDir) && File::isDirectory($this->workspaceCleanupDir)) {
        File::deleteDirectory($this->workspaceCleanupDir);
    }
});

it('init-workspace creates three template files for a tenant', function (): void {
    [$tenant] = workspaceContextTenant();
    $workspaceDir = app(WorkspaceContextService::class)->workspaceDirectory($tenant->slug);
    $this->workspaceCleanupDir = dirname($workspaceDir);

    if (File::isDirectory($workspaceDir)) {
        File::deleteDirectory($workspaceDir);
    }

    Artisan::call('carina:init-workspace', ['tenant' => $tenant->slug]);

    expect(Artisan::output())->toContain('Workspace files ready')
        ->and(File::exists($workspaceDir.'/PROPERTY_PROFILE.md'))->toBeTrue()
        ->and(File::exists($workspaceDir.'/COMPLIANCE_RULES.md'))->toBeTrue()
        ->and(File::exists($workspaceDir.'/DEAL_CRITERIA.md'))->toBeTrue();
});

it('init-workspace skips files that already exist', function (): void {
    [$tenant] = workspaceContextTenant();
    $workspaceDir = app(WorkspaceContextService::class)->workspaceDirectory($tenant->slug);
    $this->workspaceCleanupDir = dirname($workspaceDir);

    File::ensureDirectoryExists($workspaceDir);
    File::put($workspaceDir.'/PROPERTY_PROFILE.md', "# Existing profile\n");

    Artisan::call('carina:init-workspace', ['tenant' => $tenant->slug]);

    expect(Artisan::output())->toContain('Skipped (exists): PROPERTY_PROFILE.md')
        ->and(File::get($workspaceDir.'/PROPERTY_PROFILE.md'))->toBe("# Existing profile\n");
});

it('buildBlock returns formatted workspace context when files exist', function (): void {
    [$tenant] = workspaceContextTenant();
    $service = app(WorkspaceContextService::class);
    $workspaceDir = $service->workspaceDirectory($tenant->slug);
    $this->workspaceCleanupDir = dirname($workspaceDir);

    File::ensureDirectoryExists($workspaceDir);
    File::put($workspaceDir.'/PROPERTY_PROFILE.md', <<<'MD'
# Investor Profile

**Strategy focus:** HMO Portsmouth
**Key goals:** 10 properties by 2027
MD);

    $block = $service->buildBlock($tenant->slug);

    expect($block)->toContain('WORKSPACE CONTEXT (loaded from tenant workspace files):')
        ->and($block)->toContain('--- INVESTOR PROFILE ---')
        ->and($block)->toContain('**Strategy focus:** HMO Portsmouth');
});

it('buildBlock returns empty string when no workspace files exist', function (): void {
    [$tenant] = workspaceContextTenant();
    $service = app(WorkspaceContextService::class);
    $workspaceDir = $service->workspaceDirectory($tenant->slug);
    $this->workspaceCleanupDir = dirname($workspaceDir);

    if (File::isDirectory($workspaceDir)) {
        File::deleteDirectory($workspaceDir);
    }

    expect($service->buildBlock($tenant->slug))->toBe('');
});

it('workspace context is injected early in the Carina system prompt', function (): void {
    [$tenant, $user] = workspaceContextTenant();
    $service = app(WorkspaceContextService::class);
    $workspaceDir = $service->workspaceDirectory($tenant->slug);
    $this->workspaceCleanupDir = dirname($workspaceDir);

    File::ensureDirectoryExists($workspaceDir);
    File::put($workspaceDir.'/PROPERTY_PROFILE.md', <<<'MD'
# Investor Profile

**Strategy focus:** HMO conversion in Portsmouth
**Key goals:** Replace employment income by 2028
MD);

    tenancy()->initialize($tenant);

    $conversation = CarinaConversation::query()->create([
        'tenant_id' => (string) $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Workspace context test',
    ]);

    $ctx = app(CarinaService::class)->buildAgentContext($conversation, $user, null, 'What is my investment strategy?');
    $systemPrompt = $ctx['system_prompt'];

    expect($systemPrompt)->toContain('WORKSPACE CONTEXT (loaded from tenant workspace files):')
        ->and($systemPrompt)->toContain('**Strategy focus:** HMO conversion in Portsmouth')
        ->and(mb_strpos($systemPrompt, 'WORKSPACE CONTEXT'))->toBeLessThan(mb_strpos($systemPrompt, 'Signed-in workspace user'));

    tenancy()->end();
});

it('baseline workspaceContextBlock resolves tenant slug when tenancy is initialized', function (): void {
    [$tenant] = workspaceContextTenant();
    $service = app(WorkspaceContextService::class);
    $workspaceDir = $service->workspaceDirectory($tenant->slug);
    $this->workspaceCleanupDir = dirname($workspaceDir);

    File::ensureDirectoryExists($workspaceDir);
    File::put($workspaceDir.'/DEAL_CRITERIA.md', "**Target gross yield:** minimum 12%\n");

    tenancy()->initialize($tenant);

    $block = app(CarinaBaselineContextService::class)->workspaceContextBlock();

    expect($block)->toContain('--- DEAL CRITERIA ---')
        ->and($block)->toContain('minimum 12%');

    tenancy()->end();
});
