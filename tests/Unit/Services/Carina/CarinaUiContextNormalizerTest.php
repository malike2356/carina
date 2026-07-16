<?php

declare(strict_types=1);

use App\Services\Carina\CarinaUiContextNormalizer;

it('returns null for empty or unusable payloads', function () {
    $n = new CarinaUiContextNormalizer;

    expect($n->fromRequestPayload(null))->toBeNull()
        ->and($n->fromRequestPayload([]))->toBeNull()
        ->and($n->fromRequestPayload(['route' => '', 'path' => '', 'label' => '']))->toBeNull()
        ->and($n->fromRequestPayload(['route' => '../../etc/passwd']))->toBeNull();
});

it('normalises valid aliases and strips unsafe label markup', function () {
    $n = new CarinaUiContextNormalizer;

    $out = $n->fromRequestPayload([
        'route_name' => 'tenant.vical.index',
        'path' => 'vical',
        'screen_label' => '  <b>Bold</b> help  ',
    ]);

    expect($out)->toMatchArray([
        'route' => 'tenant.vical.index',
        'path' => 'vical',
        'label' => 'Bold help',
    ]);
});
