<?php

declare(strict_types=1);

use App\Models\Central\Subscription;
use App\Models\Central\SubscriptionPlan;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Database\Seeders\Central\SubscriptionPlanSeeder;
use Illuminate\Support\Facades\Hash;

beforeEach(function () {
    $this->seed(FeatureFlagSeeder::class);
    $this->seed(SubscriptionPlanSeeder::class);
});

it('shows the billing attention banner when subscription is past due', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Banner PD '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@banner-pd.test',
        'plan' => 'starter',
    ]);

    $tenant->trial_ends_at = now()->subDay();
    $tenant->save();

    $operatorId = SubscriptionPlan::on('central')->where('slug', 'operator')->value('id');

    Subscription::on('central')->create([
        'tenant_id' => $tenant->id,
        'plan_id' => $operatorId,
        'stripe_customer_id' => 'cus_banner_pd',
        'stripe_subscription_id' => 'sub_banner_pd_'.uniqid(),
        'plan' => 'operator',
        'status' => 'past_due',
        'trial_ends_at' => null,
        'current_period_start' => now()->subWeek(),
        'current_period_end' => now()->addWeek(),
        'cancel_at_period_end' => false,
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $user->password = Hash::make('secret');
    $user->save();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/')
        ->assertOk()
        ->assertSee(__('billing.attention_banner.title'), false)
        ->assertSee(__('billing.attention_banner.cta'), false);
});

it('does not show the banner when subscription is active', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Banner Active '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@banner-active.test',
        'plan' => 'starter',
    ]);

    $tenant->trial_ends_at = now()->subDay();
    $tenant->save();

    $operatorId = SubscriptionPlan::on('central')->where('slug', 'operator')->value('id');

    Subscription::on('central')->create([
        'tenant_id' => $tenant->id,
        'plan_id' => $operatorId,
        'stripe_customer_id' => 'cus_banner_ok',
        'stripe_subscription_id' => 'sub_banner_ok_'.uniqid(),
        'plan' => 'operator',
        'status' => 'active',
        'trial_ends_at' => null,
        'current_period_start' => now()->subWeek(),
        'current_period_end' => now()->addWeek(),
        'cancel_at_period_end' => false,
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $user->password = Hash::make('secret');
    $user->save();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/')
        ->assertOk()
        ->assertDontSee(__('billing.attention_banner.title'), false);
});
