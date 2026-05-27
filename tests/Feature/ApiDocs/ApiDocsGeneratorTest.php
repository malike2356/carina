<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\PlatformUser;
use App\Services\ApiDocs\OpenApiSpec;
use Illuminate\Support\Facades\Storage;

beforeEach(function (): void {
    FeatureFlag::syncFromCatalogue();
    Storage::fake('local');
});

it('generates a valid OpenAPI 3.1 document', function (): void {
    $this->artisan('api:docs:build')->assertSuccessful();

    $spec = json_decode((string) Storage::disk('local')->get('api-docs/openapi.json'), true);

    expect($spec['openapi'])->toBe('3.1.0');
    expect($spec['info']['title'])->toBe('Propreneur v2 API');
    expect($spec['paths'])->not->toBeEmpty();
});

it('every operation has an x-mobile-status when present in mobile paths', function (): void {
    $this->artisan('api:docs:build')->assertSuccessful();

    $spec = json_decode((string) Storage::disk('local')->get('api-docs/openapi.json'), true);

    foreach ($spec['paths'] as $path => $methods) {
        if (! str_contains($path, '/api/v1/mobile') && ! str_contains($path, '/api/mobile/v1')) {
            continue;
        }
        foreach ($methods as $method => $op) {
            if (! is_array($op)) {
                continue;
            }
            expect($op)->toHaveKey('x-mobile-status', "Missing x-mobile-status on {$method} {$path}");
        }
    }
});

it('check mode passes when mobile routes are listed in config', function (): void {
    $this->artisan('api:docs:build --check')->assertSuccessful();
});

it('serves the api docs page for platform super admin', function (): void {
    FeatureFlag::query()->where('key', 'admin_design_system_lab')->update([
        'enabled' => true,
        'tenant_overrides' => null,
    ]);
    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->get(route('admin.api-docs.index'))
        ->assertOk()
        ->assertSee('API documentation', false);

    $this->actingAs($admin, 'platform')
        ->get(route('admin.api-docs.spec'))
        ->assertOk();
});

it('includes tenant mobile routes in the generated spec', function (): void {
    $spec = app(OpenApiSpec::class)->build();
    $paths = array_keys($spec['paths'] ?? []);

    expect($paths)->toContain('/api/v1/mobile/profile');
    expect($paths)->toContain('/api/mobile/v1/token');
});
