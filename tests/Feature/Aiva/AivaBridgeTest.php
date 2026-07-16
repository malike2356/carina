<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\CarinaRemoteApiKey;
use App\Models\Tenant\ComplianceItem;
use App\Models\Tenant\EmailProcessingLog;
use App\Models\Tenant\Property;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;

function aivaBridgeTenantHost(): string
{
    test()->seed(FeatureFlagSeeder::class);
    FeatureFlag::syncFromCatalogue();

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Aiva Bridge '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@aiva-bridge.test',
        'plan' => 'starter',
    ]);

    test()->tenant = $tenant;
    test()->host = $tenant->domains->first()->domain.'.propreneur.test';

    $flag = FeatureFlag::query()->where('key', 'aiva_external_bridge')->firstOrFail();
    $flag->setTenantOverride((string) $tenant->getTenantKey(), true);

    tenancy()->initialize($tenant);
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    return test()->host;
}

it('returns portfolio for valid bridge key', function (): void {
    $host = aivaBridgeTenantHost();
    tenancy()->initialize(test()->tenant);

    $user = User::query()->firstOrFail();

    Property::query()->create([
        'address_line1' => '12 Test Street',
        'city' => 'Leeds',
        'postcode' => 'LS1 1AA',
        'status' => 'owned',
        'property_type' => 'flat',
        'created_by' => $user->id,
    ]);
    [$plain] = CarinaRemoteApiKey::mint('bridge test', $user->id);

    tenancy()->end();

    $response = $this->getJson('http://'.$host.'/api/aiva-bridge/portfolio', [
        'Authorization' => 'Bearer '.$plain,
    ]);

    $response->assertOk()
        ->assertJsonPath('total', 1)
        ->assertJsonPath('properties.0.address_line1', '12 Test Street');
});

it('returns compliance for a property', function (): void {
    $host = aivaBridgeTenantHost();
    tenancy()->initialize(test()->tenant);

    $user = User::query()->firstOrFail();

    $property = Property::query()->create([
        'address_line1' => 'Unit 12',
        'city' => 'Leeds',
        'postcode' => 'LS2 2BB',
        'status' => 'owned',
        'property_type' => 'flat',
        'created_by' => $user->id,
    ]);

    ComplianceItem::query()->create([
        'property_id' => $property->id,
        'created_by' => $user->id,
        'category' => 'safety',
        'type' => 'gas_safety',
        'title' => 'Gas Safety Certificate',
        'status' => 'valid',
        'expires_at' => now()->addMonths(6)->toDateString(),
    ]);

    [$plain] = CarinaRemoteApiKey::mint('compliance', $user->id);

    tenancy()->end();

    $response = $this->getJson('http://'.$host.'/api/aiva-bridge/properties/'.$property->id.'/compliance', [
        'Authorization' => 'Bearer '.$plain,
    ]);

    $response->assertOk()
        ->assertJsonPath('property_id', $property->id)
        ->assertJsonPath('items.0.type', 'gas_safety');
});

it('returns 404 when bridge feature flag is disabled', function (): void {
    $host = aivaBridgeTenantHost();
    tenancy()->initialize(test()->tenant);

    $flag = FeatureFlag::query()->where('key', 'aiva_external_bridge')->firstOrFail();
    $flag->setTenantOverride((string) test()->tenant->getTenantKey(), false);

    $user = User::query()->firstOrFail();
    [$plain] = CarinaRemoteApiKey::mint('disabled', $user->id);
    tenancy()->end();

    $response = $this->getJson('http://'.$host.'/api/aiva-bridge/portfolio', [
        'Authorization' => 'Bearer '.$plain,
    ]);

    $response->assertNotFound();
});

it('returns 401 without api key', function (): void {
    $host = aivaBridgeTenantHost();

    $response = $this->getJson('http://'.$host.'/api/aiva-bridge/portfolio');

    $response->assertUnauthorized();
});

it('returns email activity for the last 24 hours', function (): void {
    $host = aivaBridgeTenantHost();
    tenancy()->initialize(test()->tenant);

    $user = User::query()->firstOrFail();

    EmailProcessingLog::query()->create([
        'message_id' => 'msg-'.uniqid(),
        'sender' => 'accountant@example.test',
        'subject' => 'Monthly rent statement',
        'body_snippet' => 'Rent received for Flat 4',
        'classification' => 'rent_statement',
        'status' => 'processed',
        'processed_at' => now(),
    ]);

    [$plain] = CarinaRemoteApiKey::mint('email activity', $user->id);
    tenancy()->end();

    $response = $this->getJson('http://'.$host.'/api/aiva-bridge/email-activity?hours=24', [
        'Authorization' => 'Bearer '.$plain,
    ]);

    $response->assertOk()
        ->assertJsonPath('total', 1)
        ->assertJsonPath('recent.0.subject', 'Monthly rent statement')
        ->assertJsonPath('recent.0.classification', 'rent_statement');
});
