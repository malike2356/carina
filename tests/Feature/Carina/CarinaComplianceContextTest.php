<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\Tenant;
use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\ComplianceItem;
use App\Models\Tenant\Contact;
use App\Models\Tenant\Property;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaBaselineContextService;
use App\Services\Carina\CarinaComplianceContextService;
use App\Services\Carina\CarinaComplianceSlashCommandService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'compliance')->update(['enabled' => true]);
});

/**
 * @return array{0: Tenant, 1: User, 2: Property, 3: string}
 */
function carinaComplianceTenant(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Carina Compliance '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@carina-compliance.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = Property::query()->create([
        'address_line1' => '14 Compliance Lane',
        'city' => 'Leeds',
        'postcode' => 'LS1 1AA',
        'property_type' => 'hmo',
        'status' => 'managing',
        'strategy' => 'hmo',
        'created_by' => $user->id,
    ]);

    Contact::query()->create([
        'first_name' => 'Sensitive',
        'last_name' => 'Tenant',
        'email' => 'tenant-sensitive@example.com',
        'phone' => '07700900123',
        'created_by' => $user->id,
    ]);

    ComplianceItem::query()->create([
        'property_id' => $property->id,
        'created_by' => $user->id,
        'category' => 'safety',
        'type' => 'gas_safety',
        'title' => 'Gas safety certificate',
        'expires_at' => now()->subDays(3)->toDateString(),
        'reminder_days' => 30,
        'status' => 'expired',
    ]);

    $tenantKey = (string) $tenant->getTenantKey();
    tenancy()->end();

    return [$tenant, $user, $property, $tenantKey];
}

it('buildContext returns a non-empty string with expected section headers', function (): void {
    [$tenant, , , $tenantKey] = carinaComplianceTenant();
    tenancy()->initialize($tenant);

    $context = app(CarinaComplianceContextService::class)->buildContext($tenantKey);

    expect($context)->not->toBe('')
        ->and($context)->toContain('[COMPLIANCE SNAPSHOT]')
        ->and($context)->toContain('[URGENT ITEMS]')
        ->and($context)->toContain('[HHSRS CAT 1]')
        ->and($context)->toContain('[ENFORCEMENT]')
        ->and($context)->toContain('[FINANCIAL PENALTIES]')
        ->and($context)->toContain('[HMO LICENCES EXPIRING]');

    tenancy()->end();
});

it('buildContext does not include personal data patterns', function (): void {
    [$tenant, , , $tenantKey] = carinaComplianceTenant();
    tenancy()->initialize($tenant);

    $context = app(CarinaComplianceContextService::class)->buildContext($tenantKey);

    expect($context)->not->toMatch('/@[a-z0-9.-]+\.[a-z]{2,}/i')
        ->and($context)->not->toMatch('/07700900123/')
        ->and($context)->not->toContain('tenant-sensitive@example.com')
        ->and($context)->not->toContain('Sensitive Tenant');

    tenancy()->end();
});

it('compliance-status slash command returns structured output', function (): void {
    [$tenant] = carinaComplianceTenant();
    tenancy()->initialize($tenant);

    $reply = app(CarinaComplianceSlashCommandService::class)->tryHandle('/compliance-status');

    expect($reply)->not->toBeNull()
        ->and($reply)->toContain('Compliance status (live workspace snapshot)')
        ->and($reply)->toContain('Certificates:')
        ->and($reply)->toContain('HMO licences:')
        ->and($reply)->toContain('Enforcement:');

    tenancy()->end();
});

it('syncConversationHash stores snapshot hash on conversation', function (): void {
    [$tenant, $user, , $tenantKey] = carinaComplianceTenant();
    tenancy()->initialize($tenant);

    $conversation = CarinaConversation::query()->create([
        'tenant_id' => $tenantKey,
        'user_id' => $user->id,
        'title' => 'Compliance thread',
    ]);

    app(CarinaComplianceContextService::class)->syncConversationHash($conversation);
    $conversation->refresh();

    expect($conversation->compliance_snapshot_hash)->not->toBeNull()
        ->and($conversation->compliance_context_version)->toBe(CarinaComplianceContextService::CONTEXT_VERSION);

    tenancy()->end();
});

it('appendixForUser includes compliance snapshot when module enabled', function (): void {
    [$tenant, $user] = carinaComplianceTenant();
    tenancy()->initialize($tenant);

    $appendix = app(CarinaBaselineContextService::class)->appendixForUser($user);

    expect($appendix)->toContain('[COMPLIANCE SNAPSHOT]');

    tenancy()->end();
});
