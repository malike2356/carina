<?php

declare(strict_types=1);

use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use App\Support\Navigation\WorkspaceSettingsHubPresenter;
use Database\Seeders\ThemePresetSeeder;

beforeEach(function (): void {
    $this->seed(ThemePresetSeeder::class);
});

it('includes workspace appearance in settings hub for tenant admin without branding feature flag', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Hub Appearance '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@hub-appearance.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    $admin->assignRole('tenant_admin');
    tenancy()->end();

    $sections = app(WorkspaceSettingsHubPresenter::class)->sections($tenant, $admin);

    $labels = collect($sections)
        ->flatMap(static fn (array $section): array => array_column($section['items'], 'label'))
        ->all();

    expect($labels)->toContain('Workspace appearance');
});

it('includes my profile in settings hub for any authenticated tenant user', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Hub Profile '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@hub-profile.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    tenancy()->end();

    $sections = app(WorkspaceSettingsHubPresenter::class)->sections($tenant, $user);

    $labels = collect($sections)
        ->flatMap(static fn (array $section): array => array_column($section['items'], 'label'))
        ->all();

    expect($labels)->toContain('My profile');
});
