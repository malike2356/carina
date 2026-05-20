<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\PlatformUser;
use App\Models\Central\PromoCode;
use App\Services\Referral\ReferralProgrammeService;
use App\Services\Share\ShareLinkService;

beforeEach(function (): void {
    FeatureFlag::query()->where('key', 'saas_tenant_management')->update(['enabled' => true]);
});

it('builds referral and promo signup urls', function (): void {
    $links = app(ShareLinkService::class);

    config(['referral.signup_base_url' => 'https://propreneur.uk/start']);

    expect($links->referralSignupUrl('ABC12345'))
        ->toBe('https://propreneur.uk/start?ref=ABC12345');

    expect($links->promoSignupUrl('SAVE50'))
        ->toContain('promo=SAVE50');
});

it('serves referral qr svg for platform admins', function (): void {
    $admin = PlatformUser::factory()->superAdmin()->create();
    $tenant = createCentralTenant();
    $code = app(ReferralProgrammeService::class)->generateCode($tenant);

    $this->actingAs($admin, 'platform')
        ->get(route('admin.referral-codes.qr', $code))
        ->assertOk()
        ->assertHeader('content-type', 'image/svg+xml');
});

it('returns not found for inactive referral qr', function (): void {
    $admin = PlatformUser::factory()->superAdmin()->create();
    $tenant = createCentralTenant();
    $code = app(ReferralProgrammeService::class)->generateCode($tenant);
    $code->update(['is_active' => false]);

    $this->actingAs($admin, 'platform')
        ->get(route('admin.referral-codes.qr', $code))
        ->assertNotFound();
});

it('serves promo qr svg for platform admins', function (): void {
    $admin = PlatformUser::factory()->superAdmin()->create();
    $promo = PromoCode::query()->create([
        'code' => 'QRTEST01',
        'name' => 'QR test',
        'discount_type' => 'free_trial_days',
        'discount_value' => 7,
        'is_active' => true,
    ]);

    $this->actingAs($admin, 'platform')
        ->get(route('admin.promo-codes.qr', $promo))
        ->assertOk()
        ->assertHeader('content-type', 'image/svg+xml');
});

it('redirects start links with promo codes to registration', function (): void {
    $this->get('/start?promo=HELLO123')
        ->assertRedirect(route('central.register', ['promo_code' => 'HELLO123']));
});
