<?php

declare(strict_types=1);

use App\Models\Central\WaitlistEntry;
use App\Models\Central\WaitlistReferral;
use App\Services\Waitlist\ReferralService;

it('marks earliest completed referrals as rewarded when threshold reached', function (): void {
    $svc = new ReferralService;
    $referrer = WaitlistEntry::factory()->confirmed()->create();

    for ($i = 0; $i < 3; $i++) {
        WaitlistReferral::query()->create([
            'referrer_id' => $referrer->id,
            'referred_email' => "r{$i}@example.test",
            'status' => WaitlistReferral::STATUS_COMPLETED,
            'reward_claimed' => false,
        ]);
    }

    $svc->evaluateRewardsForReferrer($referrer->id);

    expect(WaitlistReferral::query()->where('referrer_id', $referrer->id)->where('reward_claimed', true)->count())->toBe(3);
});

it('generates unique referral codes', function (): void {
    $svc = new ReferralService;
    $a = $svc->generateCode();
    $b = $svc->generateCode();
    expect($a)->not->toBe($b)
        ->and(strlen($a))->toBeGreaterThanOrEqual(8);
});
