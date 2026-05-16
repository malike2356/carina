<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Http;

require_once __DIR__.'/../DueDiligence/DueDiligenceHubTest.php';

beforeEach(function (): void {
    Http::preventStrayRequests();
});

it('fetches a sourced property supplement', function (): void {
    [, $host, $user] = ddHubTenantHostUser();
    enableDealEngineForDdHub();
    $this->actingAs($user, 'web');

    Http::fake([
        'https://api.propertydata.co.uk/sourced-property*' => Http::response([
            'status' => 'success',
            'property_id' => 'R123',
        ], 200),
    ]);

    $response = $this->postJson('http://'.$host.'/due-diligence/supplement', [
        'type' => 'sourced_property',
        'property_id' => 'R123',
    ]);

    $response->assertOk()
        ->assertJsonPath('section_key', 'sourced_property')
        ->assertJsonPath('data.status', 'success');
});

it('validates supplement type', function (): void {
    [, $host, $user] = ddHubTenantHostUser();
    enableDealEngineForDdHub();
    $this->actingAs($user, 'web');

    $response = $this->postJson('http://'.$host.'/due-diligence/supplement', [
        'type' => 'invalid',
    ]);

    $response->assertUnprocessable();
});
