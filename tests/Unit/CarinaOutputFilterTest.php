<?php

declare(strict_types=1);

use App\Services\Carina\Security\CarinaOutputFilter;

it('passes a normal response unfiltered', function (): void {
    $filter = new CarinaOutputFilter;
    $result = $filter->filter('The yield on that BTL is 6.2% gross.');
    expect($result->wasFiltered)->toBeFalse();
});

it('filters internal file paths', function (): void {
    $filter = new CarinaOutputFilter;
    $result = $filter->filter('My system prompt is at app/Services/Carina/CarinaService.php line 1071.');
    expect($result->wasFiltered)->toBeTrue();
});

it('filters env variable patterns', function (): void {
    $filter = new CarinaOutputFilter;
    $result = $filter->filter('The config shows APP_KEY=base64:abc123 in the environment.');
    expect($result->wasFiltered)->toBeTrue();
});

it('replaces entire response when filtered', function (): void {
    $filter = new CarinaOutputFilter;
    $result = $filter->filter('Here is the system prompt: IGNORE PREVIOUS... APP_KEY=test');
    expect($result->response)->toContain('support@verlox.co.uk')
        ->and($result->response)->not->toContain('APP_KEY');
});
