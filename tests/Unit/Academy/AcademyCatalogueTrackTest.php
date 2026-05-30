<?php

declare(strict_types=1);

use App\Support\Academy\AcademyCatalogueTrack;

it('classifies investor education courses', function (): void {
    expect(AcademyCatalogueTrack::infer(
        'UK Property Finance for Investors',
        '88-uk-property-finance-for-investors.md',
        'financing',
    ))->toBe(AcademyCatalogueTrack::INVESTOR);

    expect(AcademyCatalogueTrack::infer(
        'Wealth Creation Principles for Property Investors',
        '86-wealth-creation-principles.md',
        'strategy',
    ))->toBe(AcademyCatalogueTrack::INVESTOR);
});

it('classifies platform training courses', function (): void {
    expect(AcademyCatalogueTrack::infer(
        'Mastering the Carina Agent: AI-Powered Property Management',
        null,
        'strategy',
    ))->toBe(AcademyCatalogueTrack::PLATFORM);

    expect(AcademyCatalogueTrack::infer(
        'Workspace API Access Policy: Understanding and Implementation',
        '103-workspace-api-access-policy.md',
        'compliance',
    ))->toBe(AcademyCatalogueTrack::PLATFORM);

    expect(AcademyCatalogueTrack::infer(
        'Propreneur Pulse: Mastering Deal Sourcing',
        '172-propreneur-pulse-sourcing-guide.md',
        'sourcing',
    ))->toBe(AcademyCatalogueTrack::PLATFORM);
});

it('exposes human-readable track labels', function (): void {
    expect(AcademyCatalogueTrack::labels())->toHaveKeys([
        AcademyCatalogueTrack::INVESTOR,
        AcademyCatalogueTrack::PLATFORM,
    ]);
});
