<?php

declare(strict_types=1);

use App\Jobs\Billing\ProcessSubscriptionWebhookJob;
use App\Models\Central\ReferralConversion;
use App\Models\Central\Subscription as TenantSubscription;
use App\Models\Central\SubscriptionPlan;
use App\Services\Billing\Contracts\StripeServiceInterface;
use App\Services\Billing\Contracts\SubscriptionServiceInterface;
use App\Services\Referral\ReferralProgrammeService;
use Database\Seeders\Central\SubscriptionPlanSeeder;
use Stripe\Subscription as StripeSubscription;

it('stores referral_code_used on tenant when a valid code is used at signup', function (): void {
    $referrer = createCentralTenant();
    $service = app(ReferralProgrammeService::class);
    $code = $service->generateCode($referrer);

    $referred = createCentralTenant();
    $referred->update(['referral_code_used' => $code->code]);
    $service->recordSignup($referred, $code->code);

    $conversion = ReferralConversion::query()
        ->where('referred_tenant_id', $referred->getTenantKey())
        ->first();

    expect($conversion)->not->toBeNull();
    expect($referred->fresh()->referral_code_used)->toBe($code->code);
});

it('marks conversion as churned when markConversionChurned is called', function (): void {
    $referrer = createCentralTenant();
    $referred = createCentralTenant();
    $service = app(ReferralProgrammeService::class);
    $code = $service->generateCode($referrer);

    ReferralConversion::query()->create([
        'referral_code_id' => $code->id,
        'referred_tenant_id' => $referred->getTenantKey(),
        'status' => ReferralConversion::STATUS_QUALIFIED,
        'subscribed_at' => now()->subDays(100),
        'qualified_at' => now()->subDays(10),
    ]);

    $service->markConversionChurned($referred->getTenantKey());

    $conversion = ReferralConversion::query()
        ->where('referred_tenant_id', $referred->getTenantKey())
        ->first();

    expect($conversion->status)->toBe(ReferralConversion::STATUS_CHURNED);
});

it('marks referral conversion churned when stripe subscription is canceled', function (): void {
    $referrer = createCentralTenant();
    $referred = createCentralTenant();
    $service = app(ReferralProgrammeService::class);
    $code = $service->generateCode($referrer);

    ReferralConversion::query()->create([
        'referral_code_id' => $code->id,
        'referred_tenant_id' => $referred->getTenantKey(),
        'status' => ReferralConversion::STATUS_QUALIFIED,
        'subscribed_at' => now()->subDays(100),
        'qualified_at' => now()->subDays(10),
    ]);

    (new SubscriptionPlanSeeder)->run();
    SubscriptionPlan::on('central')->where('slug', 'operator')->update(['stripe_price_id' => 'price_test_operator']);

    TenantSubscription::on('central')->create([
        'tenant_id' => $referred->getTenantKey(),
        'plan' => 'operator',
        'status' => 'active',
        'stripe_subscription_id' => 'sub_referral_churn_'.uniqid(),
        'stripe_customer_id' => 'cus_referral_churn',
    ]);

    $stripeSubId = TenantSubscription::on('central')->where('tenant_id', $referred->getTenantKey())->value('stripe_subscription_id');

    $stripeSub = StripeSubscription::constructFrom([
        'id' => $stripeSubId,
        'object' => 'subscription',
        'status' => 'canceled',
        'customer' => 'cus_referral_churn',
        'metadata' => ['tenant_id' => $referred->getTenantKey()],
        'items' => [
            'data' => [
                ['price' => ['id' => 'price_test_operator']],
            ],
        ],
        'trial_end' => null,
        'current_period_start' => time() - 86400,
        'current_period_end' => time() + 86400,
        'cancel_at_period_end' => false,
        'canceled_at' => time(),
        'ended_at' => time(),
    ]);

    $mock = Mockery::mock(StripeServiceInterface::class);
    $mock->shouldReceive('retrieveSubscription')->with($stripeSubId)->andReturn($stripeSub);
    app()->forgetInstance(StripeServiceInterface::class);
    app()->forgetInstance(SubscriptionServiceInterface::class);
    app()->instance(StripeServiceInterface::class, $mock);

    ProcessSubscriptionWebhookJob::dispatchSync([
        'id' => 'evt_referral_churn_'.uniqid(),
        'type' => 'customer.subscription.updated',
        'data' => [
            'object' => [
                'id' => $stripeSubId,
            ],
        ],
    ]);

    $conversion = ReferralConversion::query()
        ->where('referred_tenant_id', $referred->getTenantKey())
        ->first();

    expect($conversion->status)->toBe(ReferralConversion::STATUS_CHURNED);
});
