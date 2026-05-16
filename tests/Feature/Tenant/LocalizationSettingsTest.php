<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\TenantSetting;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Spatie\Permission\PermissionRegistrar;
use Tests\Concerns\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('lets workspace admin view and save localization settings', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Loc '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@loc.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->slug.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'workspace_localization')->update(['enabled' => true]);
    completeTenantWorkspaceOnboarding();
    app(PermissionRegistrar::class)->forgetCachedPermissions();
    $user = User::query()->firstOrFail();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/settings/localization')
        ->assertOk()
        ->assertSee('Languages & locale', false);

    $this->put('http://'.$host.'/settings/localization', [
        'workspace_default_locale' => 'fr',
        'enabled_locales' => ['en', 'fr'],
    ])->assertRedirect(route('tenant.settings.localization.edit'));

    tenancy()->initialize($tenant);
    expect(TenantSetting::query()->where('key', 'localization.workspace_default_locale')->value('value'))->toBe('fr');
    tenancy()->end();
});
