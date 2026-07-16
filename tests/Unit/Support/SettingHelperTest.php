<?php

declare(strict_types=1);

use App\Models\Central\SettingDefinition;
use App\Services\Configuration\Contracts\SettingServiceInterface;
use Illuminate\Support\Facades\Cache;
use Tests\Concerns\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    Cache::flush();
});

it('exposes the setting helper bound to the setting service', function () {
    SettingDefinition::factory()->create([
        'key' => 'helper.demo',
        'default_value' => 'from-definition',
        'type' => 'string',
        'category' => 'h',
        'validation_rules' => ['laravel' => ['string', 'max:50']],
    ]);

    expect(setting('helper.demo'))->toBe('from-definition')
        ->and(setting('helper.missing', 'fallback'))->toBe('fallback');
});

it('reflects runtime updates through the helper', function () {
    SettingDefinition::factory()->create([
        'key' => 'helper.live',
        'default_value' => 'a',
        'type' => 'string',
        'category' => 'h',
        'validation_rules' => ['laravel' => ['string', 'max:50']],
    ]);

    app(SettingServiceInterface::class)->set('helper.live', 'b', null, null);

    expect(setting('helper.live'))->toBe('b');
});
