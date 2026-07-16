<?php

declare(strict_types=1);

use App\Support\Vcal\VcalPublicBranding;

test('safePrimaryHexForInlineStyle accepts six-digit hex and lowercases', function () {
    $m = (new ReflectionClass(VcalPublicBranding::class))->getMethod('safePrimaryHexForInlineStyle');
    $m->setAccessible(true);

    expect($m->invoke(null, '#AABBCC'))->toBe('#aabbcc');
    expect($m->invoke(null, '#112233'))->toBe('#112233');
});

test('safePrimaryHexForInlineStyle rejects invalid values', function () {
    $m = (new ReflectionClass(VcalPublicBranding::class))->getMethod('safePrimaryHexForInlineStyle');
    $m->setAccessible(true);

    expect($m->invoke(null, null))->toBe('');
    expect($m->invoke(null, ''))->toBe('');
    expect($m->invoke(null, '#abc'))->toBe('');
    expect($m->invoke(null, '#gg0000'))->toBe('');
    expect($m->invoke(null, 'red'))->toBe('');
    expect($m->invoke(null, 'url(x)'))->toBe('');
    expect($m->invoke(null, '#112233;'))->toBe('');
});
