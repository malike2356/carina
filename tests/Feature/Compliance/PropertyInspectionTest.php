<?php

declare(strict_types=1);

use App\Models\Tenant\InspectionDefect;
use App\Models\Tenant\Property;
use App\Models\Tenant\PropertyInspection;
use App\Models\Tenant\TenantNoticeLog;
use App\Models\Tenant\User;
use App\Services\Compliance\PropertyInspectionService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Carbon;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    $this->withoutMiddleware(VerifyCsrfToken::class);

    if (! isset($this->inspectionTenant)) {
        $this->inspectionTenant = app(TenantCreationService::class)->createTenant([
            'company_name' => 'Property Inspection Suite',
            'owner_name' => 'Owner',
            'owner_email' => 'owner-inspection-suite@property-inspection.test',
            'plan' => 'mentor_network',
        ]);
        $this->inspectionHost = $this->inspectionTenant->domains->first()->domain.'.propreneur.test';

        tenancy()->initialize($this->inspectionTenant);
        $this->inspectionUser = User::query()->firstOrFail();
        completeTenantWorkspaceOnboarding();
        $this->inspectionProperty = Property::query()->create([
            'address_line1' => '22 Inspection Road',
            'city' => 'Manchester',
            'postcode' => 'M1 2AB',
            'property_type' => 'house',
            'status' => 'managing',
            'strategy' => 'btl',
            'created_by' => $this->inspectionUser->id,
        ]);
        tenancy()->end();
    }
});

it('creates and completes an inspection', function (): void {
    $this->actingAs($this->inspectionUser, 'web');

    $this->post('http://'.$this->inspectionHost.'/inspections', [
        'property_id' => $this->inspectionProperty->id,
        'inspection_type' => 'routine',
        'scheduled_date' => '2026-06-01',
        'overall_condition' => 'fair',
        'complete_now' => '1',
        'conducted_date' => '2026-06-05',
        'inspector_name' => 'Jane Inspector',
    ])->assertRedirect();

    tenancy()->initialize($this->inspectionTenant);

    $inspection = PropertyInspection::query()->where('property_id', $this->inspectionProperty->id)
        ->where('inspector_name', 'Jane Inspector')
        ->firstOrFail();

    expect($inspection->status)->toBe('completed')
        ->and($inspection->conducted_date?->toDateString())->toBe('2026-06-05');

    tenancy()->end();
});

it('adds and resolves a defect', function (): void {
    tenancy()->initialize($this->inspectionTenant);
    $service = app(PropertyInspectionService::class);

    $inspection = $service->scheduleInspection([
        'property_id' => $this->inspectionProperty->id,
        'inspection_type' => 'move_in',
        'scheduled_date' => '2026-06-10',
        'overall_condition' => 'poor',
        'status' => 'completed',
        'conducted_date' => '2026-06-10',
    ]);

    $defect = $service->addDefect($inspection, [
        'defect_category' => 'damp_mould',
        'description' => 'Black mould on bedroom ceiling',
        'severity' => 'major',
        'photo_evidence_notes' => 'Photos taken 10 Jun 2026, bedroom 2 ceiling',
    ]);

    expect($defect->status)->toBe('open');

    $service->resolveDefect($defect, Carbon::parse('2026-06-20'), 'Treated and repainted');

    $defect->refresh();

    expect($defect->status)->toBe('resolved')
        ->and($defect->resolved_date?->toDateString())->toBe('2026-06-20')
        ->and($defect->resolution_notes)->toBe('Treated and repainted');

    tenancy()->end();
});

it('returns true from hasUrgentDefects when urgent severity defects exist', function (): void {
    tenancy()->initialize($this->inspectionTenant);
    $service = app(PropertyInspectionService::class);

    $inspection = $service->scheduleInspection([
        'property_id' => $this->inspectionProperty->id,
        'inspection_type' => 'compliance',
        'overall_condition' => 'urgent',
        'status' => 'completed',
        'conducted_date' => now()->toDateString(),
    ]);

    expect($inspection->hasUrgentDefects())->toBeFalse();

    $service->addDefect($inspection, [
        'defect_category' => 'electrical',
        'description' => 'Exposed wiring in kitchen',
        'severity' => 'urgent',
    ]);

    $inspection->refresh();

    expect($inspection->hasUrgentDefects())->toBeTrue();

    $defect = InspectionDefect::query()->where('property_inspection_id', $inspection->id)->firstOrFail();
    expect($defect->isUrgent())->toBeTrue();

    tenancy()->end();
});

it('logs a tenant notice with delivery confirmation', function (): void {
    $this->actingAs($this->inspectionUser, 'web');

    $this->post('http://'.$this->inspectionHost.'/tenant-notices', [
        'property_id' => $this->inspectionProperty->id,
        'notice_type' => 'section_21',
        'notice_date' => '2026-05-01',
        'delivery_method' => 'post_recorded',
        'delivery_confirmed' => '1',
        'delivery_date' => '2026-05-03',
        'delivery_evidence_notes' => 'Royal Mail tracked ref RM123456789GB, signed for',
    ])->assertRedirect();

    tenancy()->initialize($this->inspectionTenant);

    $notice = TenantNoticeLog::query()
        ->where('property_id', $this->inspectionProperty->id)
        ->where('notice_type', 'section_21')
        ->whereDate('notice_date', '2026-05-01')
        ->firstOrFail();

    expect($notice->isDeliveryConfirmed())->toBeTrue()
        ->and($notice->delivery_date?->toDateString())->toBe('2026-05-03')
        ->and($notice->noticeTypeLabel())->toBe('Section 21');

    tenancy()->end();
});
