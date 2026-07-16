<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\ComplianceAudit;
use App\Models\Tenant\ComplianceAuditAction;
use App\Models\Tenant\ComplianceAuditFinding;
use App\Models\Tenant\ComplianceAuditPlan;
use App\Models\Tenant\User;
use App\Services\Compliance\ComplianceAuditService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'compliance')->update(['enabled' => true]);
});

function complianceAuditTenant(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Compliance Audit '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@compliance-audit.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    return [$tenant, $host, $user];
}

it('allows a user to create a compliance audit plan', function (): void {
    [$tenant, $host, $user] = complianceAuditTenant();

    $this->actingAs($user, 'web');
    $this->post('http://'.$host.'/compliance/audit-plans', [
        'title' => 'Annual property audit',
        'audit_type' => 'internal',
        'entity_type' => 'property',
        'scheduled_date' => now()->addMonth()->toDateString(),
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $plan = ComplianceAuditPlan::query()->where('title', 'Annual property audit')->first();
    expect($plan)->not->toBeNull()
        ->and($plan->status)->toBe('planned')
        ->and($plan->created_by_user_id)->toBe($user->id);
    tenancy()->end();
});

it('allows a user to start an audit against a plan', function (): void {
    [$tenant, $host, $user] = complianceAuditTenant();

    tenancy()->initialize($tenant);
    $plan = ComplianceAuditPlan::query()->create([
        'title' => 'Q2 audit',
        'audit_type' => 'internal',
        'entity_type' => 'business',
        'scheduled_date' => now()->addWeek()->toDateString(),
        'assigned_auditor_user_id' => $user->id,
        'created_by_user_id' => $user->id,
        'status' => 'planned',
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');
    $this->post('http://'.$host.'/compliance/audit-plans/'.$plan->id.'/audits')
        ->assertRedirect();

    tenancy()->initialize($tenant);
    $plan->refresh();
    $audit = ComplianceAudit::query()->where('compliance_audit_plan_id', $plan->id)->first();
    expect($audit)->not->toBeNull()
        ->and($plan->status)->toBe('in_progress')
        ->and($audit->status)->toBe('draft');
    tenancy()->end();
});

it('allows a user to add a finding to an audit', function (): void {
    [$tenant, $host, $user] = complianceAuditTenant();

    tenancy()->initialize($tenant);
    $plan = ComplianceAuditPlan::query()->create([
        'title' => 'Finding test plan',
        'audit_type' => 'regulatory',
        'entity_type' => 'staff',
        'scheduled_date' => now()->toDateString(),
        'created_by_user_id' => $user->id,
        'status' => 'in_progress',
    ]);
    $audit = app(ComplianceAuditService::class)->startAudit($plan);
    tenancy()->end();

    $this->actingAs($user, 'web');
    $this->post('http://'.$host.'/compliance/audit-plans/audits/'.$audit->id.'/findings', [
        'title' => 'Missing gas certificate',
        'risk_level' => 'high',
        'compliance_status' => 'non_compliant',
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $finding = ComplianceAuditFinding::query()->where('compliance_audit_id', $audit->id)->first();
    expect($finding)->not->toBeNull()
        ->and($finding->title)->toBe('Missing gas certificate')
        ->and($finding->risk_level)->toBe('high');
    tenancy()->end();
});

it('allows a user to add an action to a finding', function (): void {
    [$tenant, $host, $user] = complianceAuditTenant();

    tenancy()->initialize($tenant);
    $plan = ComplianceAuditPlan::query()->create([
        'title' => 'Action test plan',
        'audit_type' => 'external',
        'entity_type' => 'property',
        'scheduled_date' => now()->toDateString(),
        'created_by_user_id' => $user->id,
        'status' => 'in_progress',
    ]);
    $audit = app(ComplianceAuditService::class)->startAudit($plan);
    $finding = app(ComplianceAuditService::class)->addFinding($audit, [
        'title' => 'Fire door defect',
        'risk_level' => 'critical',
        'compliance_status' => 'non_compliant',
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');
    $this->post('http://'.$host.'/compliance/audit-plans/findings/'.$finding->id.'/actions', [
        'title' => 'Replace fire door',
        'assigned_to_user_id' => $user->id,
        'due_date' => now()->addWeek()->toDateString(),
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $action = ComplianceAuditAction::query()->where('compliance_audit_finding_id', $finding->id)->first();
    expect($action)->not->toBeNull()
        ->and($action->title)->toBe('Replace fire door')
        ->and($action->status)->toBe('open')
        ->and($action->assigned_to_user_id)->toBe($user->id);
    tenancy()->end();
});

it('allows a user to complete an action', function (): void {
    [$tenant, $host, $user] = complianceAuditTenant();

    tenancy()->initialize($tenant);
    $plan = ComplianceAuditPlan::query()->create([
        'title' => 'Complete action plan',
        'audit_type' => 'internal',
        'entity_type' => 'business',
        'scheduled_date' => now()->toDateString(),
        'created_by_user_id' => $user->id,
        'status' => 'in_progress',
    ]);
    $audit = app(ComplianceAuditService::class)->startAudit($plan);
    $finding = app(ComplianceAuditService::class)->addFinding($audit, [
        'title' => 'Policy gap',
        'risk_level' => 'medium',
        'compliance_status' => 'partial',
    ]);
    $action = app(ComplianceAuditService::class)->addAction($finding, [
        'title' => 'Update policy',
        'assigned_to_user_id' => $user->id,
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');
    $this->post('http://'.$host.'/compliance/audit-plans/actions/'.$action->id.'/complete', [
        'completion_notes' => 'Policy updated and signed off.',
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $action->refresh();
    expect($action->status)->toBe('completed')
        ->and($action->completion_notes)->toBe('Policy updated and signed off.')
        ->and($action->completed_at)->not->toBeNull();
    tenancy()->end();
});

it('returns overdue plans past their scheduled date with status planned', function (): void {
    [$tenant] = complianceAuditTenant();

    tenancy()->initialize($tenant);
    ComplianceAuditPlan::query()->create([
        'title' => 'Overdue plan',
        'audit_type' => 'internal',
        'entity_type' => 'property',
        'scheduled_date' => now()->subDays(3)->toDateString(),
        'status' => 'planned',
    ]);
    ComplianceAuditPlan::query()->create([
        'title' => 'Future plan',
        'audit_type' => 'internal',
        'entity_type' => 'property',
        'scheduled_date' => now()->addMonth()->toDateString(),
        'status' => 'planned',
    ]);
    ComplianceAuditPlan::query()->create([
        'title' => 'Past but completed',
        'audit_type' => 'internal',
        'entity_type' => 'property',
        'scheduled_date' => now()->subWeek()->toDateString(),
        'status' => 'completed',
    ]);

    $overdue = app(ComplianceAuditService::class)->getOverduePlans();
    expect($overdue)->toHaveCount(1)
        ->and($overdue->first()->title)->toBe('Overdue plan');
    tenancy()->end();
});
