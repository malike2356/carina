<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\AuditLog;
use App\Models\Tenant\AuditLogHash;
use App\Models\Tenant\Property;
use App\Models\Tenant\User;
use App\Services\Audit\AuditHashService;
use App\Services\Audit\AuditService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('writes audit rows and hash chain when a property is created', function (): void {
    Http::preventStrayRequests();

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Audit trait '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@audit-trait.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'workspace_audit_logging')->update(['enabled' => true]);
    completeTenantWorkspaceOnboarding();

    $user = User::query()->firstOrFail();
    Auth::login($user);

    Property::query()->create([
        'address_line1' => '99 Audit Street',
        'city' => 'Leeds',
        'postcode' => 'LS11AA',
        'property_type' => 'flat',
        'status' => 'managing',
        'created_by' => $user->id,
    ]);

    $property = Property::query()->where('address_line1', '99 Audit Street')->firstOrFail();
    $logs = AuditLog::query()->forModel(Property::class, $property->id)->get();
    expect($logs)->not->toBeEmpty();
    expect(AuditLogHash::query()->count())->toBeGreaterThan(0);

    tenancy()->end();
});

it('lets workspace admin open the audit log UI', function (): void {
    Http::preventStrayRequests();

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Audit UI '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@audit-ui.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'workspace_audit_logging')->update(['enabled' => true]);
    completeTenantWorkspaceOnboarding();
    $user = User::query()->firstOrFail();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/admin/audit/logs')
        ->assertOk()
        ->assertSee('Workspace audit log', false);
});

it('verifies hash chain after manual log entries', function (): void {
    Http::preventStrayRequests();

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Audit hash '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@audit-hash.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    completeTenantWorkspaceOnboarding();

    $audit = app(AuditService::class);
    $audit->log([
        'event_type' => 'test.event',
        'model_type' => 'test',
        'model_id' => '1',
        'new_values' => ['a' => 1],
    ]);
    $audit->log([
        'event_type' => 'test.event',
        'model_type' => 'test',
        'model_id' => '2',
        'new_values' => ['a' => 2],
    ]);

    $result = app(AuditHashService::class)->verifyChain();
    expect($result['ok'] ?? false)->toBeTrue();

    tenancy()->end();
});
