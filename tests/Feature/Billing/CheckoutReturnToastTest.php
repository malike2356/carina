<?php

declare(strict_types=1);

use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Database\Seeders\Central\SubscriptionPlanSeeder;
use Illuminate\Support\Facades\Hash;

beforeEach(function () {
    $this->seed(FeatureFlagSeeder::class);
    $this->seed(SubscriptionPlanSeeder::class);
});

it('redirects from checkout success query and flashes a friendly message', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Checkout OK '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@checkout-ok.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $user->password = Hash::make('secret');
    $user->save();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $key = config('billing.checkout.state_query_param', 'billing');
    $ok = config('billing.checkout.success_billing_state', 'success');

    $this->get('http://'.$host.'/settings/subscriptions?'.$key.'='.$ok)
        ->assertRedirect('/settings/subscriptions')
        ->assertSessionHas('success', __('billing.checkout.success'));
});

it('redirects from checkout cancel query and flashes a friendly message', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Checkout Cancel '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@checkout-cancel.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $user->password = Hash::make('secret');
    $user->save();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $key = config('billing.checkout.state_query_param', 'billing');
    $cancel = config('billing.checkout.cancel_billing_state', 'cancel');

    $this->get('http://'.$host.'/settings/subscriptions?'.$key.'='.$cancel)
        ->assertRedirect('/settings/subscriptions')
        ->assertSessionHas('info', __('billing.checkout.cancelled'));
});
