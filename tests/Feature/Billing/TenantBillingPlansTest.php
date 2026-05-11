<?php

declare(strict_types=1);

use App\Jobs\Billing\ProcessSubscriptionWebhookJob;
use App\Models\Central\SubscriptionPlan;
use App\Models\Tenant\User;
use App\Services\Billing\Contracts\StripeServiceInterface;
use App\Services\Billing\Contracts\SubscriptionServiceInterface;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Database\Seeders\Central\SubscriptionPlanSeeder;
use Illuminate\Support\Facades\Hash;
use Stripe\Subscription;

beforeEach(function () {
    $this->seed(FeatureFlagSeeder::class);
    $this->seed(SubscriptionPlanSeeder::class);
});

it('lists billing plans on the tenant host', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Billing Plans '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@billing-plans.test',
        'plan' => 'operator',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $user->password = Hash::make('secret');
    $user->save();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $response = $this->getJson('http://'.$host.'/api/billing/plans');

    $response->assertOk();
    $slugs = collect($response->json('data'))->pluck('slug')->all();
    expect($slugs)->toContain('operator', 'mentor_network')
        ->and($slugs)->not->toContain('solo', 'starter_payg');
});

it('persists a subscription row when a stripe subscription webhook is processed', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Webhook Sub '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@webhook-sub.test',
        'plan' => 'operator',
    ]);

    $this->seed(SubscriptionPlanSeeder::class);
    SubscriptionPlan::on('central')->where('slug', 'operator')->update(['stripe_price_id' => 'price_test_operator']);

    $stripeSub = Subscription::constructFrom([
        'id' => 'sub_test_'.uniqid(),
        'object' => 'subscription',
        'status' => 'active',
        'customer' => 'cus_test_1',
        'metadata' => ['tenant_id' => $tenant->id],
        'items' => [
            'data' => [
                ['price' => ['id' => 'price_test_operator']],
            ],
        ],
        'trial_end' => null,
        'current_period_start' => time(),
        'current_period_end' => time() + 86400 * 30,
        'cancel_at_period_end' => false,
        'canceled_at' => null,
        'ended_at' => null,
    ]);

    $mock = Mockery::mock(StripeServiceInterface::class);
    $mock->shouldReceive('retrieveSubscription')->with($stripeSub->id)->andReturn($stripeSub);
    app()->forgetInstance(StripeServiceInterface::class);
    app()->forgetInstance(SubscriptionServiceInterface::class);
    app()->instance(StripeServiceInterface::class, $mock);

    $payload = [
        'id' => 'evt_sub_'.uniqid(),
        'type' => 'customer.subscription.updated',
        'data' => [
            'object' => [
                'id' => $stripeSub->id,
            ],
        ],
    ];

    ProcessSubscriptionWebhookJob::dispatchSync($payload);

    $row = App\Models\Central\Subscription::on('central')->where('tenant_id', $tenant->id)->first();
    expect($row)->not->toBeNull();
    expect($row->status)->toBe('active');
    expect($row->stripe_subscription_id)->toBe($stripeSub->id);
});
