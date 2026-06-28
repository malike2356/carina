<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\Tenant;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaBaselineContextService;
use App\Services\Carina\CarinaSkillMarkdownParser;
use App\Services\Carina\SkillContextInjector;
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
function skillCompilerTenant(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Skill Compiler '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@skill-compiler.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    return [$tenant, $user];
}

it('compiles a valid skill file to the manifest', function (): void {
    $outputPath = storage_path('app/carina/compiled-skills-test-'.uniqid().'.json');

    Artisan::call('carina:compile-skills', [
        '--output' => $outputPath,
        '--skip-hub' => true,
    ]);

    expect(Artisan::output())->toContain('3 skills compiled. 0 failed.')
        ->and(File::exists($outputPath))->toBeTrue();

    $manifest = json_decode((string) file_get_contents($outputPath), true);
    expect($manifest['skills'] ?? null)->toBeArray()
        ->and(collect($manifest['skills'])->pluck('name')->all())->toContain('hmo-room-yield-benchmarks');

    File::delete($outputPath);
});

it('rejects a skill file missing required frontmatter', function (): void {
    $tempDir = storage_path('app/carina/skills-test-'.uniqid());
    File::ensureDirectoryExists($tempDir);
    File::put($tempDir.'/invalid-skill.md', "# No frontmatter\n\nBody only.\n");

    $outputPath = storage_path('app/carina/compiled-skills-invalid-'.uniqid().'.json');

    Artisan::call('carina:compile-skills', [
        '--skills-dir' => $tempDir,
        '--output' => $outputPath,
    ]);

    expect(Artisan::output())->toContain('1 failed.')
        ->and(File::exists($outputPath))->toBeFalse();

    File::deleteDirectory($tempDir);
});

it('SkillContextInjector returns relevant skill for matching message', function (): void {
    $manifestPath = storage_path('app/carina/compiled-skills-injector-'.uniqid().'.json');
    File::put($manifestPath, json_encode([
        'compiled_at' => now()->utc()->toIso8601String(),
        'skills' => [[
            'name' => 'hmo-room-yield-benchmarks',
            'description' => 'UK HMO room yield benchmarks',
            'version' => '1.0',
            'applies_when' => ['room yield', 'hmo returns'],
            'tags' => ['hmo'],
            'content' => 'Portsmouth standard double rooms often rent for 95-120 per week.',
        ]],
    ], JSON_PRETTY_PRINT));

    $injector = new SkillContextInjector($manifestPath);
    $blocks = $injector->relevantSkillBlocks('What is a typical HMO room yield in Portsmouth?');

    expect($blocks)->toHaveCount(1)
        ->and($blocks[0])->toContain('KNOWLEDGE: UK HMO room yield benchmarks')
        ->and($blocks[0])->toContain('Portsmouth standard double rooms');

    File::delete($manifestPath);
});

it('SkillContextInjector returns empty when no skill matches', function (): void {
    $manifestPath = storage_path('app/carina/compiled-skills-injector-empty-'.uniqid().'.json');
    File::put($manifestPath, json_encode([
        'compiled_at' => now()->utc()->toIso8601String(),
        'skills' => [[
            'name' => 'sdlt-rates-2024',
            'description' => 'SDLT rates',
            'version' => '1.0',
            'applies_when' => ['stamp duty land tax'],
            'tags' => [],
            'content' => 'Rates table...',
        ]],
    ], JSON_PRETTY_PRINT));

    $injector = new SkillContextInjector($manifestPath);
    $blocks = $injector->relevantSkillBlocks('Tell me about Manchester BTL yields only.');

    expect($blocks)->toBeEmpty();

    File::delete($manifestPath);
});

it('compiled skill blocks are injected into baseline context', function (): void {
    [$tenant, $user] = skillCompilerTenant();

    $manifestPath = base_path('storage/app/carina/compiled-skills.json');
    File::ensureDirectoryExists(dirname($manifestPath));
    File::put($manifestPath, json_encode([
        'compiled_at' => now()->utc()->toIso8601String(),
        'skills' => [[
            'name' => 'hmo-room-yield-benchmarks',
            'description' => 'UK HMO room yield benchmarks by city',
            'version' => '1.0',
            'applies_when' => ['hmo room yield'],
            'tags' => ['hmo'],
            'content' => 'Portsmouth en-suite rooms often reach 115-145 per week.',
        ]],
    ], JSON_PRETTY_PRINT));

    app()->forgetInstance(SkillContextInjector::class);

    tenancy()->initialize($tenant);

    $appendix = app(CarinaBaselineContextService::class)->appendixForUser(
        $user,
        'What is a typical HMO room yield in Portsmouth?',
    );

    expect($appendix)->toContain('KNOWLEDGE: UK HMO room yield benchmarks by city')
        ->and($appendix)->toContain('Portsmouth en-suite rooms often reach 115-145 per week');

    tenancy()->end();
});

it('skips hub fetch when --skip-hub is passed', function (): void {
    $outputPath = storage_path('app/carina/compiled-skills-skip-hub-'.uniqid().'.json');

    Artisan::call('carina:compile-skills', [
        '--output' => $outputPath,
        '--skip-hub' => true,
    ]);

    $manifest = json_decode((string) file_get_contents($outputPath), true);
    expect(collect($manifest['skills'] ?? [])->pluck('source')->unique()->all())->toBe(['local']);

    File::delete($outputPath);
});

it('compile command rejects duplicate skill names', function (): void {
    $tempDir = storage_path('app/carina/skills-dup-'.uniqid());
    File::ensureDirectoryExists($tempDir);
    File::put($tempDir.'/one.md', <<<'MD'
---
name: duplicate-skill
description: First
version: 1.0
applies_when:
  - test trigger
---
Body one.
MD);
    File::put($tempDir.'/two.md', <<<'MD'
---
name: duplicate-skill
description: Second
version: 1.0
applies_when:
  - other trigger
---
Body two.
MD);

    $outputPath = storage_path('app/carina/compiled-skills-dup-'.uniqid().'.json');

    Artisan::call('carina:compile-skills', [
        '--skills-dir' => $tempDir,
        '--output' => $outputPath,
    ]);

    expect(Artisan::output())->toContain('Duplicate skill name')
        ->and(File::exists($outputPath))->toBeFalse();

    File::deleteDirectory($tempDir);
});
