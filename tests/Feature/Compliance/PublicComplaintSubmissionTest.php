<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\ComplaintCase;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'compliance')->update(['enabled' => true]);
});

it('accepts a public complaint via API and creates a case', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Public Complaint '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@public-complaint.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    $response = $this->postJson('http://'.$host.'/api/v1/complaints', [
        'complainant_name' => 'Jane Public',
        'complainant_email' => 'jane@example.com',
        'subject' => 'Heating fault',
        'summary' => 'No heating for three days in flat 2.',
        'category' => 'property',
    ]);

    $response->assertCreated()
        ->assertJsonPath('success', true);

    tenancy()->initialize($tenant);
    $case = ComplaintCase::query()->where('complainant_email', 'jane@example.com')->first();
    expect($case)->not->toBeNull()
        ->and($case->channel)->toBe('portal')
        ->and($case->reference)->toStartWith('CMP-');
    tenancy()->end();
});

it('rejects honeypot spam silently', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Complaint honeypot '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@complaint-honeypot.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    $this->postJson('http://'.$host.'/api/v1/complaints', [
        'complainant_name' => 'Bot',
        'complainant_email' => 'bot@spam.test',
        'subject' => 'Spam',
        'summary' => 'Spam',
        'website' => 'http://spam.test',
    ])->assertOk()->assertJsonPath('success', true);

    tenancy()->initialize($tenant);
    expect(ComplaintCase::query()->where('complainant_email', 'bot@spam.test')->exists())->toBeFalse();
    tenancy()->end();
});

it('serves the public embed complaints page', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Complaint embed '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@complaint-embed.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    $this->get('http://'.$host.'/embed/complaints')
        ->assertOk()
        ->assertSee('Make a complaint', false);
});
