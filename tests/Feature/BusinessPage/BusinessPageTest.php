<?php

declare(strict_types=1);

use App\Models\Tenant\BusinessPageSettings;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Tests\Concerns\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

function createBusinessPageTenantHost(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Biz Page '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@bizpage.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->slug.'.propreneur.test';

    tenancy()->initialize($tenant);
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    return [$tenant, $host];
}

it('returns 404 at /site when the business page is not published', function (): void {
    [, $host] = createBusinessPageTenantHost();

    $this->get('http://'.$host.'/site')->assertNotFound();
});

it('returns 200 at /site when the business page is published', function (): void {
    [$tenant, $host] = createBusinessPageTenantHost();

    tenancy()->initialize($tenant);
    BusinessPageSettings::query()->create([
        'published' => true,
        'published_at' => now(),
        'hero_headline' => 'Welcome',
    ]);
    tenancy()->end();

    $this->get('http://'.$host.'/site')->assertOk();
});

it('shows hero headline and contact email on the public page', function (): void {
    [$tenant, $host] = createBusinessPageTenantHost();

    tenancy()->initialize($tenant);
    BusinessPageSettings::query()->create([
        'published' => true,
        'published_at' => now(),
        'hero_headline' => 'Property mentoring that works',
        'contact_email' => 'hello@example.test',
    ]);
    tenancy()->end();

    $this->get('http://'.$host.'/site')
        ->assertOk()
        ->assertSee('Property mentoring that works', false)
        ->assertSee('hello@example.test', false);
});

it('does not show sections with empty content', function (): void {
    [$tenant, $host] = createBusinessPageTenantHost();

    tenancy()->initialize($tenant);
    BusinessPageSettings::query()->create([
        'published' => true,
        'published_at' => now(),
        'hero_headline' => 'Only hero',
        'contact_email' => null,
        'about_html' => null,
        'services' => null,
    ]);
    tenancy()->end();

    $response = $this->get('http://'.$host.'/site')->assertOk();

    $response->assertSee('Only hero', false);
    $response->assertDontSee('>Services<', false);
    $response->assertDontSee('>Contact<', false);
});

it('lets workspace admin update and publish the business page', function (): void {
    [$tenant, $host] = createBusinessPageTenantHost();

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    tenancy()->end();

    $this->actingAs($admin, 'web');

    $this->put('http://'.$host.'/settings/business-page', [
        'hero_headline' => 'Grow your portfolio',
        'contact_email' => 'team@workspace.test',
    ])->assertRedirect(route('tenant.settings.business-page.edit'));

    $this->post('http://'.$host.'/settings/business-page/publish')
        ->assertRedirect(route('tenant.settings.business-page.edit'));

    tenancy()->initialize($tenant);
    $settings = BusinessPageSettings::current();
    expect($settings)->not->toBeNull()
        ->and($settings->published)->toBeTrue()
        ->and($settings->hero_headline)->toBe('Grow your portfolio')
        ->and($settings->published_at)->not->toBeNull();
    tenancy()->end();

    $this->get('http://'.$host.'/site')->assertOk();
});

it('lets workspace admin unpublish the business page', function (): void {
    [$tenant, $host] = createBusinessPageTenantHost();

    tenancy()->initialize($tenant);
    BusinessPageSettings::query()->create([
        'published' => true,
        'published_at' => now(),
        'hero_headline' => 'Live page',
    ]);
    $admin = User::query()->firstOrFail();
    tenancy()->end();

    $this->actingAs($admin, 'web');

    $this->post('http://'.$host.'/settings/business-page/unpublish')
        ->assertRedirect(route('tenant.settings.business-page.edit'));

    tenancy()->initialize($tenant);
    expect(BusinessPageSettings::current()?->published)->toBeFalse();
    tenancy()->end();

    $this->get('http://'.$host.'/site')->assertNotFound();
});

it('lets workspace admin preview the business page regardless of published state', function (): void {
    [$tenant, $host] = createBusinessPageTenantHost();

    tenancy()->initialize($tenant);
    BusinessPageSettings::query()->create([
        'published' => false,
        'hero_headline' => 'Draft headline',
    ]);
    $admin = User::query()->firstOrFail();
    tenancy()->end();

    $this->actingAs($admin, 'web');

    $this->get('http://'.$host.'/settings/business-page/preview')
        ->assertOk()
        ->assertSee('Draft headline', false)
        ->assertSee('Preview mode', false);
});

it('forbids non-admin tenant users from business page settings', function (): void {
    [$tenant, $host] = createBusinessPageTenantHost();

    tenancy()->initialize($tenant);
    $staff = User::factory()->create(['email' => 'staff-'.uniqid().'@bizpage.test']);
    $staff->syncRoles(['team_member']);
    tenancy()->end();

    $this->actingAs($staff, 'web');

    $this->get('http://'.$host.'/settings/business-page')->assertForbidden();
});

it('saves and displays three services on the public page', function (): void {
    [$tenant, $host] = createBusinessPageTenantHost();

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    tenancy()->end();

    $this->actingAs($admin, 'web');

    $this->put('http://'.$host.'/settings/business-page', [
        'services' => [
            ['title' => 'Deal sourcing', 'description' => 'Find off-market deals'],
            ['title' => 'Portfolio review', 'description' => 'Monthly check-ins'],
            ['title' => 'Mentoring', 'description' => '1:1 guidance'],
        ],
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    BusinessPageSettings::current()?->update([
        'published' => true,
        'published_at' => now(),
    ]);
    tenancy()->end();

    $this->get('http://'.$host.'/site')
        ->assertOk()
        ->assertSee('Deal sourcing', false)
        ->assertSee('Portfolio review', false)
        ->assertSee('Mentoring', false)
        ->assertSee('Find off-market deals', false);
});

it('resolves legal footer links', function (): void {
    [, $host] = createBusinessPageTenantHost();

    $this->get('http://'.$host.'/legal/privacy_policy')->assertOk();
    $this->get('http://'.$host.'/legal/terms_of_service')->assertOk();
});

it('shows powered by Propreneur on the public page', function (): void {
    [$tenant, $host] = createBusinessPageTenantHost();

    tenancy()->initialize($tenant);
    BusinessPageSettings::query()->create([
        'published' => true,
        'published_at' => now(),
        'hero_headline' => 'Hello',
    ]);
    tenancy()->end();

    $this->get('http://'.$host.'/site')
        ->assertOk()
        ->assertSee('Powered by', false)
        ->assertSee('Propreneur', false);
});
