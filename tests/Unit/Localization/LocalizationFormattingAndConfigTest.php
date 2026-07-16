<?php

declare(strict_types=1);

use App\Services\Localization\FormattingService;
use App\Services\Localization\LocalizationService;

it('formats dates and numbers without tenant context', function () {
    app()->setLocale('en');
    $fmt = app(FormattingService::class);

    expect($fmt->formatDate('2024-06-01', 'Y-m-d'))->toBe('2024-06-01');
    expect($fmt->formatNumber(99.1, 1))->toBeString();
    expect(strlen($fmt->formatCurrency(10, 'GBP')))->toBeGreaterThan(0);
});

it('detects rtl from configured locale list', function () {
    $svc = app(LocalizationService::class);

    expect($svc->isRtl('ar'))->toBeTrue();
    expect($svc->isRtl('en'))->toBeFalse();
});

it('returns fallback chain from config', function () {
    $svc = app(LocalizationService::class);

    expect($svc->getFallbackLocales('fr'))->toContain('en');
});

it('includes uk regional locales in the shipped catalogue', function () {
    $locales = config('localization.available_locales', []);

    expect(array_keys($locales))->toContain('cy', 'gd', 'ga', 'kw', 'uls');
    expect($locales['cy']['native'])->toBe('Cymraeg');
});
