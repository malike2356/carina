<?php

declare(strict_types=1);

use App\Services\Onboarding\GettingStartedChecklistService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function () {
    $this->seed(FeatureFlagSeeder::class);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('hides and restores the getting started checklist on the dashboard', function () {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Checklist Hide '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@checklist-hide.test',
        'plan' => 'mentor_network',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $user = \App\Models\Tenant\User::query()->firstOrFail();
    $this->actingAs($user, 'web');
    $base = 'http://'.$host;

    $this->get($base.'/')
        ->assertOk()
        ->assertSee('Getting started')
        ->assertSee('Hide and complete later');

    $this->post($base.'/getting-started/hide')
        ->assertRedirect($base.'/')
        ->assertSessionHas('status');

    tenancy()->initialize($tenant);
    expect(app(GettingStartedChecklistService::class)->isHidden())->toBeTrue();
    tenancy()->end();

    $this->get($base.'/')
        ->assertOk()
        ->assertDontSee('Hide and complete later')
        ->assertSee('Show checklist again');

    $this->post($base.'/getting-started/show')
        ->assertRedirect($base.'/')
        ->assertSessionHas('status');

    tenancy()->initialize($tenant);
    expect(app(GettingStartedChecklistService::class)->isHidden())->toBeFalse();
    tenancy()->end();

    $this->get($base.'/')
        ->assertOk()
        ->assertSee('Getting started')
        ->assertSee('Hide and complete later');
});
