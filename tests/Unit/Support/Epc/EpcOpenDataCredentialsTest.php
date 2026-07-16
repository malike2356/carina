<?php

declare(strict_types=1);

use App\Models\Central\PlatformSetting;
use App\Support\Epc\EpcOpenDataCredentials;

it('builds Basic auth from platform settings', function (): void {
    config(['services.epc_opendata.auth_email' => '', 'services.epc_opendata.api_key' => '']);

    PlatformSetting::query()->updateOrCreate(
        ['key' => 'epc_opendatacommunities_auth_email'],
        [
            'group' => 'integrations',
            'value' => 'dev@example.test',
            'type' => 'string',
            'label' => 'x',
            'description' => null,
            'is_encrypted' => false,
            'is_public' => false,
        ]
    );
    PlatformSetting::query()->updateOrCreate(
        ['key' => 'epc_opendatacommunities_api_key'],
        [
            'group' => 'integrations',
            'value' => 'secret-api-key',
            'type' => 'string',
            'label' => 'x',
            'description' => null,
            'is_encrypted' => false,
            'is_public' => false,
        ]
    );

    $header = (new EpcOpenDataCredentials)->authorizationBasicHeader();

    expect($header)->toBe('Basic '.base64_encode('dev@example.test:secret-api-key'))
        ->and((new EpcOpenDataCredentials)->isConfigured())->toBeTrue();
});

it('falls back to env when platform rows are empty', function (): void {
    PlatformSetting::query()->where('key', 'epc_opendatacommunities_auth_email')->delete();
    PlatformSetting::query()->where('key', 'epc_opendatacommunities_api_key')->delete();

    config([
        'services.epc_opendata.auth_email' => 'env@example.test',
        'services.epc_opendata.api_key' => 'env-key',
    ]);

    expect((new EpcOpenDataCredentials)->authorizationBasicHeader())
        ->toBe('Basic '.base64_encode('env@example.test:env-key'));
});
