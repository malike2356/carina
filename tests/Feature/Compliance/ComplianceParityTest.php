<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\AmlRecord;
use App\Models\Tenant\AmlTrainingLog;
use App\Models\Tenant\ComplaintCase;
use App\Models\Tenant\ComplianceItem;
use App\Models\Tenant\ComplianceRequirement;
use App\Models\Tenant\RegulatoryProfile;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'compliance')->update(['enabled' => true]);
});

function complianceParityTenant(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Compliance Parity '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@compliance-parity.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    return [$tenant, $host, $user];
}

it('stores an AML record', function (): void {
    [$tenant, $host, $user] = complianceParityTenant();

    $this->actingAs($user, 'web');
    $this->post('http://'.$host.'/compliance/aml/records', [
        'check_date' => now()->toDateString(),
        'check_type' => 'identity',
        'result' => 'pass',
        'risk_rating' => 'low',
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    expect(AmlRecord::query()->where('result', 'pass')->where('checked_by', $user->id)->exists())->toBeTrue();
    tenancy()->end();
});

it('deletes an AML record', function (): void {
    [$tenant, $host, $user] = complianceParityTenant();

    tenancy()->initialize($tenant);
    $record = AmlRecord::factory()->create([
        'checked_by' => $user->id,
        'result' => 'pending',
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');
    $this->delete('http://'.$host.'/compliance/aml/records/'.$record->id)
        ->assertRedirect();

    tenancy()->initialize($tenant);
    expect(AmlRecord::withTrashed()->find($record->id)?->trashed())->toBeTrue();
    tenancy()->end();
});

it('stores an AML training log', function (): void {
    [$tenant, $host, $user] = complianceParityTenant();

    $this->actingAs($user, 'web');
    $this->post('http://'.$host.'/compliance/aml/training', [
        'user_id' => $user->id,
        'training_type' => 'online_module',
        'training_date' => now()->toDateString(),
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    expect(AmlTrainingLog::query()->where('user_id', $user->id)->exists())->toBeTrue();
    tenancy()->end();
});

it('creates a complaint case with auto reference', function (): void {
    [$tenant, $host, $user] = complianceParityTenant();

    $this->actingAs($user, 'web');
    $this->post('http://'.$host.'/compliance/complaints', [
        'complainant_name' => 'Jane Doe',
        'channel' => 'email',
        'category' => 'service',
        'subject' => 'Test complaint',
        'summary' => 'Something went wrong.',
        'status' => 'received',
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $case = ComplaintCase::query()->first();
    expect($case)->not->toBeNull()
        ->and($case->reference)->toStartWith('CMP-');
    tenancy()->end();
});

it('resolves a complaint case', function (): void {
    [$tenant, $host, $user] = complianceParityTenant();

    tenancy()->initialize($tenant);
    $case = ComplaintCase::factory()->create([
        'complainant_name' => 'Jane Doe',
        'status' => 'investigating',
        'created_by_user_id' => $user->id,
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');
    $this->put('http://'.$host.'/compliance/complaints/'.$case->id, [
        'complainant_name' => $case->complainant_name,
        'channel' => $case->channel,
        'category' => $case->category,
        'subject' => $case->subject,
        'summary' => $case->summary,
        'status' => 'resolved',
        'resolved_at' => now()->toDateString(),
        'outcome_summary' => 'Issue resolved.',
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    expect(ComplaintCase::find($case->id)?->status)->toBe('resolved');
    tenancy()->end();
});

it('creates a compliance requirement and logs a check against it', function (): void {
    [$tenant, $host, $user] = complianceParityTenant();

    $this->actingAs($user, 'web');
    $this->post('http://'.$host.'/compliance/requirements', [
        'name' => 'Annual AML policy review',
        'entity_type' => 'workspace',
        'is_critical' => '1',
        'frequency_days' => 365,
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $req = ComplianceRequirement::query()->where('name', 'Annual AML policy review')->firstOrFail();
    tenancy()->end();

    $this->post('http://'.$host.'/compliance/requirements/'.$req->id.'/checks', [
        'check_date' => now()->toDateString(),
        'status' => 'compliant',
        'compliance_score' => 95,
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $req->refresh();
    expect($req->isCompliant())->toBeTrue();
    tenancy()->end();
});

it('saves regulatory profile as singleton', function (): void {
    [$tenant, $host, $user] = complianceParityTenant();

    $this->actingAs($user, 'web');
    $this->put('http://'.$host.'/compliance/regulatory', [
        'supervisor_type' => 'hmrc_estate_agency_uk',
        'registration_status' => 'registered',
        'redress_scheme' => 'prs',
        'ico_registration_ref' => 'ZA123456',
        'ico_renewal_due' => now()->addYear()->toDateString(),
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $profile = RegulatoryProfile::forWorkspace();
    expect($profile->ico_registration_ref)->toBe('ZA123456')
        ->and($profile->registration_status)->toBe('registered');
    RegulatoryProfile::forWorkspace();
    expect(RegulatoryProfile::query()->count())->toBe(1);
    tenancy()->end();
});

it('generates a PDF compliance report', function (): void {
    [$tenant, $host, $user] = complianceParityTenant();

    tenancy()->initialize($tenant);
    ComplianceItem::query()->create([
        'created_by' => $user->id,
        'category' => 'legal',
        'type' => 'epc',
        'title' => 'EPC for PDF test',
        'status' => 'valid',
        'reminder_days' => 30,
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');
    $response = $this->get('http://'.$host.'/compliance/export/pdf');

    $response->assertOk();
    expect(str_contains((string) $response->headers->get('content-type'), 'pdf'))->toBeTrue();
});
