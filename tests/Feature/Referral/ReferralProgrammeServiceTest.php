<?php

declare(strict_types=1);

use App\Models\Central\ReferralConversion;
use App\Models\Central\ReferralCredit;
use App\Services\Referral\ReferralProgrammeService;

beforeEach(function (): void {
    $this->service = app(ReferralProgrammeService::class);
});

it('generates a unique code for a tenant', function (): void {
    $tenant = createCentralTenant();
    $code = $this->service->generateCode($tenant);

    expect($code->code)->toHaveLength(8);
    expect($code->is_active)->toBeTrue();
    expect($code->tenant_id)->toBe($tenant->getTenantKey());
});

it('records a signup conversion against an active code', function (): void {
    $referrer = createCentralTenant();
    $referred = createCentralTenant();
    $code = $this->service->generateCode($referrer);

    $conversion = $this->service->recordSignup($referred, $code->code);

    expect($conversion)->not->toBeNull();
    expect($conversion->status)->toBe(ReferralConversion::STATUS_PENDING);
    expect($conversion->referred_tenant_id)->toBe($referred->getTenantKey());
});

it('does not record a conversion for an inactive code', function (): void {
    $referrer = createCentralTenant();
    $referred = createCentralTenant();
    $code = $this->service->generateCode($referrer);
    $code->update(['is_active' => false]);

    $result = $this->service->recordSignup($referred, $code->code);

    expect($result)->toBeNull();
});

it('does not allow self-referral', function (): void {
    $tenant = createCentralTenant();
    $code = $this->service->generateCode($tenant);

    $result = $this->service->recordSignup($tenant, $code->code);

    expect($result)->toBeNull();
});

it('qualifies a pending conversion after the holding period', function (): void {
    $referrer = createCentralTenant();
    $referred = createCentralTenant();
    $code = $this->service->generateCode($referrer, 25.00, 1);

    ReferralConversion::query()->create([
        'referral_code_id' => $code->id,
        'referred_tenant_id' => $referred->getTenantKey(),
        'status' => ReferralConversion::STATUS_PENDING,
        'subscribed_at' => now()->subDays(2),
    ]);

    $qualified = $this->service->qualifyPendingConversions();

    expect($qualified)->toBe(1);
    expect(
        ReferralConversion::query()->where('referred_tenant_id', $referred->getTenantKey())->first()->status
    )->toBe(ReferralConversion::STATUS_QUALIFIED);
});

it('calculates credits for a period with qualified conversions', function (): void {
    $referrer = createCentralTenant();
    $code = $this->service->generateCode($referrer, 25.00, 90);

    for ($i = 0; $i < 3; $i++) {
        $ref = createCentralTenant();
        ReferralConversion::query()->create([
            'referral_code_id' => $code->id,
            'referred_tenant_id' => $ref->getTenantKey(),
            'status' => ReferralConversion::STATUS_QUALIFIED,
            'subscribed_at' => now()->subDays(100),
            'qualified_at' => now()->subDays(10),
        ]);
    }

    $count = $this->service->calculateCreditsForPeriod('2026-06');

    expect($count)->toBe(1);
    $credit = ReferralCredit::query()->where('referral_code_id', $code->id)->first();
    expect((float) $credit->credit_amount)->toBe(75.00);
});
