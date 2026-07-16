<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\ComplianceFormSubmission;
use App\Models\Tenant\CompliancePolicy;
use App\Models\Tenant\Document;
use App\Models\Tenant\RegulatoryPremise;
use App\Models\Tenant\RegulatoryProfile;
use App\Models\Tenant\RegulatoryReminder;
use App\Models\Tenant\SourcerComplianceProfile;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Facades\Storage;

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'compliance')->update(['enabled' => true]);
});

function v1ComplianceStrengthsTenant(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Compliance V1 Strengths '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@compliance-strengths.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    return [$tenant, $host, $user];
}

it('saves sourcer readiness and computes progress', function (): void {
    [$tenant, $host, $user] = v1ComplianceStrengthsTenant();

    $this->actingAs($user, 'web');
    $this->put('http://'.$host.'/compliance/sourcer-readiness', [
        'ltd_company_registered' => '1',
        'companies_house_number' => '12345678',
        'shares_issued' => '1',
        'day_to_day_bank_account' => '1',
        'pi_insurance' => '1',
        'public_liability_insurance' => '1',
        'ico_registration_number' => 'ZA123456',
        'property_redress_scheme' => 'prs',
        'aml_registration_applied' => '1',
        'aml_policy_document_uploaded' => '1',
        'aml_record_log_in_place' => '1',
        'complaints_procedure_uploaded' => '1',
        'terms_and_conditions_uploaded' => '1',
        'privacy_policy_live' => '1',
        'invoicing_system' => 'xero',
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $profile = SourcerComplianceProfile::forWorkspace();
    expect($profile->completionPercent())->toBe(100);
    tenancy()->end();
});

it('adds regulatory premises and reminders to the singleton profile', function (): void {
    [$tenant, $host, $user] = v1ComplianceStrengthsTenant();

    $this->actingAs($user, 'web');
    $this->post('http://'.$host.'/compliance/regulatory/premises', [
        'label' => 'Main office',
        'address_line1' => '1 Compliance Street',
        'city' => 'London',
        'postcode' => 'SW1A 1AA',
        'country' => 'United Kingdom',
        'mlr_trading_from' => now()->subYear()->toDateString(),
    ])->assertRedirect();

    $this->post('http://'.$host.'/compliance/regulatory/reminders', [
        'title' => 'Renew AML supervision',
        'due_date' => now()->addMonth()->toDateString(),
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $profile = RegulatoryProfile::forWorkspace();
    expect(RegulatoryPremise::query()->where('regulatory_profile_id', $profile->id)->count())->toBe(1)
        ->and(RegulatoryReminder::query()->where('regulatory_profile_id', $profile->id)->count())->toBe(1);
    tenancy()->end();
});

it('stores config-driven compliance intake submissions', function (): void {
    [$tenant, $host, $user] = v1ComplianceStrengthsTenant();

    $this->actingAs($user, 'web');
    $this->post('http://'.$host.'/compliance/intakes', [
        'form_key' => 'client_onboarding',
        'status' => 'submitted',
        'payload' => [
            'client_legal_name' => 'Example Client Ltd',
            'client_type' => 'company',
            'primary_email' => 'client@example.test',
        ],
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $submission = ComplianceFormSubmission::query()->firstOrFail();
    expect($submission->status)->toBe('submitted')
        ->and($submission->payload['client_legal_name'])->toBe('Example Client Ltd')
        ->and($submission->submitted_at)->not->toBeNull();
    tenancy()->end();
});

it('stores compliance policies and exports one to the document vault', function (): void {
    Storage::fake('local');
    [$tenant, $host, $user] = v1ComplianceStrengthsTenant();

    $this->actingAs($user, 'web');
    $this->post('http://'.$host.'/compliance/policies', [
        'type' => 'aml',
        'title' => 'AML policy',
        'content_html' => '<p>AML controls and review cadence.</p>',
        'version' => '1.0',
        'is_active' => '1',
        'effective_at' => now()->toDateString(),
        'review_due_at' => now()->addYear()->toDateString(),
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $policy = CompliancePolicy::query()->firstOrFail();
    tenancy()->end();

    $this->post('http://'.$host.'/compliance/policies/'.$policy->id.'/export')
        ->assertRedirect();

    tenancy()->initialize($tenant);
    $policy->refresh();
    expect($policy->document_id)->not->toBeNull()
        ->and(Document::query()->whereKey($policy->document_id)->exists())->toBeTrue();
    tenancy()->end();
});

it('supports tenant compliance policy crud screens', function (): void {
    [$tenant, $host, $user] = v1ComplianceStrengthsTenant();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/compliance/policies')
        ->assertOk()
        ->assertSee('Policy register')
        ->assertSee('New policy');

    $this->get('http://'.$host.'/compliance/policies/create')
        ->assertOk()
        ->assertSee('Create policy');

    $this->post('http://'.$host.'/compliance/policies', [
        'type' => 'aml',
        'title' => 'CRUD AML policy',
        'content_html' => '<h2>AML policy</h2><p>Initial controls.</p>',
        'version' => '1.0',
        'is_active' => '1',
        'effective_at' => now()->toDateString(),
        'review_due_at' => now()->addYear()->toDateString(),
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $policy = CompliancePolicy::query()->where('title', 'CRUD AML policy')->firstOrFail();
    tenancy()->end();

    $this->get('http://'.$host.'/compliance/policies')
        ->assertOk()
        ->assertSee('CRUD AML policy')
        ->assertSee('View')
        ->assertSee('Edit')
        ->assertSee('Archive');

    $this->get('http://'.$host.'/compliance/policies/'.$policy->id)
        ->assertOk()
        ->assertSee('CRUD AML policy')
        ->assertSee('<h2>AML policy</h2>', false);

    $this->get('http://'.$host.'/compliance/policies/'.$policy->id.'/edit')
        ->assertOk()
        ->assertSee('Save policy');

    $this->put('http://'.$host.'/compliance/policies/'.$policy->id, [
        'type' => 'data_protection',
        'title' => 'CRUD Data policy',
        'content_html' => '<h2>Data policy</h2><p>Updated controls.</p>',
        'version' => '1.1',
        'is_active' => '1',
        'effective_at' => now()->toDateString(),
        'review_due_at' => now()->addMonths(6)->toDateString(),
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $policy->refresh();
    expect($policy->title)->toBe('CRUD Data policy')
        ->and($policy->type)->toBe('data_protection')
        ->and($policy->version)->toBe('1.1');
    tenancy()->end();

    $this->delete('http://'.$host.'/compliance/policies/'.$policy->id)
        ->assertRedirect('http://'.$host.'/compliance/policies');

    tenancy()->initialize($tenant);
    expect(CompliancePolicy::query()->whereKey($policy->id)->exists())->toBeFalse()
        ->and(CompliancePolicy::withTrashed()->whereKey($policy->id)->first()?->trashed())->toBeTrue();
    tenancy()->end();
});

it('normalizes entity escaped policy html from the editor before previewing', function (): void {
    [$tenant, $host, $user] = v1ComplianceStrengthsTenant();

    $this->actingAs($user, 'web');
    $this->post('http://'.$host.'/compliance/policies', [
        'type' => 'client_due_diligence',
        'title' => 'CDD procedure',
        'content_html' => '&lt;h2&gt;Client Due Diligence&lt;/h2&gt; &lt;p&gt;Check {{company_name}} records.&lt;/p&gt;',
        'version' => '1.0',
        'is_active' => '1',
        'effective_at' => now()->toDateString(),
        'review_due_at' => now()->addYear()->toDateString(),
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $policy = CompliancePolicy::query()->where('title', 'CDD procedure')->firstOrFail();
    expect($policy->content_html)->toContain('<h2>Client Due Diligence</h2>')
        ->and($policy->renderedContentHtml())->toContain('<p>Check {{company_name}} records.</p>');
    tenancy()->end();

    $this->get('http://'.$host.'/compliance/policies/'.$policy->id)
        ->assertOk()
        ->assertSee('<h2>Client Due Diligence</h2>', false)
        ->assertDontSee('&lt;h2&gt;', false);
});

it('imports the v1 compliance template pack idempotently', function (): void {
    [$tenant, $host, $user] = v1ComplianceStrengthsTenant();

    $this->actingAs($user, 'web');
    $this->post('http://'.$host.'/compliance/template-pack/import')
        ->assertRedirect();

    tenancy()->initialize($tenant);
    expect(CompliancePolicy::query()->count())->toBeGreaterThan(8)
        ->and(CompliancePolicy::query()->where('title', 'Anti-Money Laundering Policy')->exists())->toBeTrue()
        ->and(CompliancePolicy::query()->where('title', 'In-House Complaints Procedure')->exists())->toBeTrue()
        ->and(CompliancePolicy::query()->where('title', 'Data Protection Policy and Privacy Notice')->exists())->toBeTrue()
        ->and(CompliancePolicy::query()->where('title', 'Legionella Awareness Staff Training Question Pool')->exists())->toBeTrue();
    $countAfterFirstImport = CompliancePolicy::query()->count();
    tenancy()->end();

    $this->post('http://'.$host.'/compliance/template-pack/import')
        ->assertRedirect();

    tenancy()->initialize($tenant);
    expect(CompliancePolicy::query()->count())->toBe($countAfterFirstImport);
    tenancy()->end();
});
