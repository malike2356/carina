<?php

declare(strict_types=1);

use App\Services\Carina\Security\ConversationAnomalyDetector;
use Illuminate\Contracts\Cache\Repository;
use Illuminate\Support\Str;

it('is not anomalous on first probe', function (): void {
    $cache = app(Repository::class);
    $detector = new ConversationAnomalyDetector($cache);
    $id = 'conv_first_'.Str::random(8);
    $result = $detector->recordAndCheck($id, 0.8);
    expect($result->anomalous)->toBeFalse()
        ->and($result->probeCount)->toBeGreaterThanOrEqual(1);
});

it('flags anomaly after threshold is reached', function (): void {
    $cache = app(Repository::class);
    $detector = new ConversationAnomalyDetector($cache);
    $id = 'conv_thr_'.Str::random(8);
    $detector->recordAndCheck($id, 0.55);
    $detector->recordAndCheck($id, 0.55);
    $result = $detector->recordAndCheck($id, 0.55);
    expect($result->anomalous)->toBeTrue();
});
