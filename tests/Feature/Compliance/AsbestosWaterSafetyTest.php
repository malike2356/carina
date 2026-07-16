<?php

declare(strict_types=1);

use App\Models\Tenant\AsbestosMaterial;
use App\Models\Tenant\AsbestosRegister;
use App\Models\Tenant\Property;
use App\Models\Tenant\User;
use App\Models\Tenant\WaterHygieneLog;
use App\Services\Compliance\AsbestosWaterSafetyService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

function awsSharedTenant(): array
{
    static $cached = null;

    if ($cached !== null) {
        return $cached;
    }

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'AWS Test Shared',
        'owner_name' => 'Owner',
        'owner_email' => 'owner-aws-shared@aws.test',
        'plan' => 'mentor_network',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $cached = [$tenant, $host, $user];

    return $cached;
}

function awsHmoProperty(User $user): Property
{
    return Property::query()->create([
        'address_line1' => '8 ACM Lane '.uniqid(),
        'city' => 'Leeds',
        'postcode' => 'LS2 2BB',
        'property_type' => 'hmo',
        'strategy' => 'hmo',
        'status' => 'managing',
        'created_by' => $user->id,
    ]);
}

it('creates an asbestos register with materials', function (): void {
    [$tenant, , $user] = awsSharedTenant();

    tenancy()->initialize($tenant);
    $property = awsHmoProperty($user);
    $service = app(AsbestosWaterSafetyService::class);

    $register = $service->createAsbestosRegister([
        'property_id' => $property->id,
        'survey_type' => 'management',
        'surveyor_name' => 'UKAS Surveyor',
        'survey_date' => '2026-01-10',
        'created_by_user_id' => $user->id,
    ]);

    $material = $service->addMaterial($register, [
        'location' => 'Hall ceiling',
        'material_type' => 'Artex ceiling',
        'asbestos_type' => 'chrysotile',
        'condition' => 'fair',
        'risk_score' => 'medium',
        'management_action' => 'monitor',
    ]);

    expect($register)->toBeInstanceOf(AsbestosRegister::class)
        ->and($material)->toBeInstanceOf(AsbestosMaterial::class)
        ->and($register->materials)->toHaveCount(1)
        ->and($register->materials->first()->location)->toBe('Hall ceiling');

    tenancy()->end();
});

it('hasHighRiskMaterials returns true when any material has risk_score high', function (): void {
    [$tenant, , $user] = awsSharedTenant();

    tenancy()->initialize($tenant);
    $property = awsHmoProperty($user);
    $service = app(AsbestosWaterSafetyService::class);

    $register = $service->createAsbestosRegister([
        'property_id' => $property->id,
        'survey_type' => 'management',
        'surveyor_name' => 'Surveyor',
        'survey_date' => now()->toDateString(),
        'created_by_user_id' => $user->id,
    ]);

    expect($register->hasHighRiskMaterials())->toBeFalse();

    $service->addMaterial($register, [
        'location' => 'Boiler cupboard',
        'material_type' => 'Insulation board',
        'condition' => 'poor',
        'risk_score' => 'high',
        'management_action' => 'seal',
    ]);

    $register->load('materials');

    expect($register->hasHighRiskMaterials())->toBeTrue();

    tenancy()->end();
});

it('records pass fail for water hygiene temperature targets', function (): void {
    [$tenant, , $user] = awsSharedTenant();

    tenancy()->initialize($tenant);
    $property = awsHmoProperty($user);
    $service = app(AsbestosWaterSafetyService::class);

    $assessment = $service->createLegionellaAssessment([
        'property_id' => $property->id,
        'assessment_date' => now()->toDateString(),
        'assessor_name' => 'Water Assessor',
        'property_occupancy_pattern' => 'continuous',
        'risk_level' => 'medium',
        'created_by_user_id' => $user->id,
    ]);

    $passing = $service->logWaterHygiene([
        'property_id' => $property->id,
        'legionella_assessment_id' => $assessment->id,
        'log_date' => now()->toDateString(),
        'log_type' => 'temperature_check',
        'outlet_location' => 'Kitchen tap',
        'hot_water_temp_c' => 58.0,
        'cold_water_temp_c' => 18.5,
        'logged_by_user_id' => $user->id,
    ]);

    $failing = $service->logWaterHygiene([
        'property_id' => $property->id,
        'legionella_assessment_id' => $assessment->id,
        'log_date' => now()->toDateString(),
        'log_type' => 'temperature_check',
        'outlet_location' => 'Bathroom basin',
        'hot_water_temp_c' => 48.0,
        'cold_water_temp_c' => 22.0,
        'logged_by_user_id' => $user->id,
    ]);

    expect($passing->hot_within_target)->toBeTrue()
        ->and($passing->cold_within_target)->toBeTrue()
        ->and($passing->isHotWaterFailing())->toBeFalse()
        ->and($failing->hot_within_target)->toBeFalse()
        ->and($failing->cold_within_target)->toBeFalse()
        ->and($failing->isHotWaterFailing())->toBeTrue()
        ->and($failing->isColdWaterFailing())->toBeTrue();

    tenancy()->end();
});

it('isHotWaterFailing returns true when hot_water_temp_c is below 55', function (): void {
    [$tenant, , $user] = awsSharedTenant();

    tenancy()->initialize($tenant);
    $property = awsHmoProperty($user);

    $log = app(AsbestosWaterSafetyService::class)->logWaterHygiene([
        'property_id' => $property->id,
        'log_date' => now()->toDateString(),
        'log_type' => 'temperature_check',
        'hot_water_temp_c' => 52.0,
        'logged_by_user_id' => $user->id,
    ]);

    expect($log)->toBeInstanceOf(WaterHygieneLog::class)
        ->and($log->hot_within_target)->toBeFalse()
        ->and($log->isHotWaterFailing())->toBeTrue();

    tenancy()->end();
});
