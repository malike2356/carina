<?php

declare(strict_types=1);

use App\Models\Central\PlatformSetting;
use App\Services\Epc\EpcOpenDataService;
use App\Support\Epc\EpcOpenDataCredentials;

it('EpcOpenDataService returns null when not configured', function (): void {
    PlatformSetting::query()->where('key', 'epc_opendatacommunities_auth_email')->delete();
    PlatformSetting::query()->where('key', 'epc_opendatacommunities_api_key')->delete();
    config(['services.epc_opendata.auth_email' => '', 'services.epc_opendata.api_key' => '']);

    $service = new EpcOpenDataService(new EpcOpenDataCredentials);
    expect($service->isConfigured())->toBeFalse();
    expect($service->latestForPostcode('SW1A 2AA'))->toBeNull();
});

it('EpcOpenDataService summarise extracts correct rating', function (): void {
    $service = new EpcOpenDataService(new EpcOpenDataCredentials);

    $cert = [
        'lmk-key' => 'ABC123',
        'current-energy-rating' => 'c',
        'potential-energy-rating' => 'B',
        'current-energy-efficiency' => 72,
        'potential-energy-efficiency' => 84,
        'inspection-date' => '2023-06-15',
        'property-type' => 'Flat',
        'total-floor-area' => 65,
        'improvement-description-1' => 'Loft insulation',
        'indicative-cost-1' => '£300 - £400',
        'typical-saving-1' => '£55',
    ];

    $summary = $service->summarise($cert);

    expect($summary['current_energy_rating'])->toBe('C');
    expect($summary['potential_energy_rating'])->toBe('B');
    expect($summary['current_energy_score'])->toBe(72);
    expect($summary['improvements'])->toHaveCount(1);
    expect($summary['improvements'][0]['measure'])->toBe('Loft insulation');
});
