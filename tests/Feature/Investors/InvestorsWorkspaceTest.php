<?php

declare(strict_types=1);

use App\Models\Tenant\Contact;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function () {
    $this->seed(FeatureFlagSeeder::class);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('shows investors overview and updates funnel stage for an investor contact', function () {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Inv Mod '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@inv-ws.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $investor = Contact::factory()->investor()->create([
        'created_by' => $user->id,
        'investor_funnel_stage' => 'lead',
    ]);

    tenancy()->end();

    $this->actingAs($user, 'web');
    $this->get('http://'.$host.'/investors')
        ->assertOk()
        ->assertSee('Investor overview');

    $this->get('http://'.$host.'/investors/funnel')
        ->assertOk()
        ->assertSee('Your investor capital journey', false)
        ->assertSee('Source', false);

    $this->post('http://'.$host.'/investors/funnel/'.$investor->id, [
        'investor_funnel_stage' => 'qualified',
        'qualification_score' => '7',
        'is_vip' => '1',
        'vip_monthly_fee' => '29.99',
        'reservation_method_confirmed' => '1',
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $investor->refresh();
    expect($investor->investor_funnel_stage)->toBe('qualified')
        ->and($investor->is_vip)->toBeTrue()
        ->and((float) $investor->vip_monthly_fee)->toBe(29.99);
    tenancy()->end();
});
