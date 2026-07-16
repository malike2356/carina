<?php

declare(strict_types=1);

use App\Http\Controllers\Tenant\HelpCenterController;
use App\Models\Central\HelpArticle;
use App\Models\Central\HelpSection;
use App\Models\Tenant\User;
use App\Services\HelpCenter\HelpContentSyncService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Http\Request;

it('serves help section and article pages over http', function (): void {
    $this->artisan('help:sync')->assertExitCode(0);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Help Section '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@help-section.test',
        'plan' => 'starter',
    ]);
    $host = actingAsTenant($tenant);

    $this->get(tenantHttpUrl($host, 'help/getting-started'))
        ->assertOk()
        ->assertSee('Getting Started');

    $this->get(tenantHttpUrl($host, 'help/getting-started/what-is-propreneur'))
        ->assertOk()
        ->assertSee('What is Propreneur', false);
});

it('serves the help center index over http', function (): void {
    $this->artisan('help:sync')->assertExitCode(0);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Help Center '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@help.test',
        'plan' => 'starter',
    ]);
    $host = actingAsTenant($tenant);

    $this->get(tenantHttpUrl($host, 'help'))
        ->assertOk()
        ->assertSee('Help Center')
        ->assertSee('Getting Started');
});

it('renders section and article views when tenancy is initialized', function (): void {
    $this->artisan('help:sync')->assertExitCode(0);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Help Center Views '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@help-views.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $this->actingAs(User::query()->firstOrFail(), 'web');

    $controller = app(HelpCenterController::class);
    $syncService = app(HelpContentSyncService::class);

    $sub = (string) $tenant->slug;
    $sectionView = $controller->section($sub, 'getting-started', $syncService);
    expect($sectionView->name())->toBe('tenant.help.section');

    $articleView = $controller->article($sub, 'getting-started', 'what-is-propreneur', $syncService);
    expect($articleView->name())->toBe('tenant.help.article')
        ->and($articleView->getData()['html'])->toContain('<strong>');

    $searchView = $controller->search(new Request(['q' => 'Propreneur']));
    expect($searchView->name())->toBe('tenant.help.search');

    $article = HelpArticle::on('central')->where('slug', 'what-is-propreneur')->firstOrFail();
    $article->update(['is_published' => false]);

    $sectionAfter = $controller->section($sub, 'getting-started', $syncService);
    expect(collect($sectionAfter->getData()['articles'])->pluck('slug')->all())
        ->not->toContain('what-is-propreneur');

    tenancy()->end();
});

it('help:sync command inserts sections and articles', function (): void {
    $this->artisan('help:sync')->assertExitCode(0);

    expect(HelpSection::on('central')->count())->toBeGreaterThan(15)
        ->and(HelpArticle::on('central')->count())->toBeGreaterThan(100);
});

it('lazy-syncs missing help sections such as accounting on first visit', function (): void {
    $this->artisan('help:sync')->assertExitCode(0);

    HelpSection::on('central')->where('slug', 'accounting')->delete();

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Help Accounting '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@help-accounting.test',
        'plan' => 'starter',
    ]);
    $host = actingAsTenant($tenant);

    $this->get(tenantHttpUrl($host, 'help/accounting'))
        ->assertOk()
        ->assertSee('Accounting', false);

    expect(HelpSection::on('central')->where('slug', 'accounting')->where('is_published', true)->exists())->toBeTrue();
});
