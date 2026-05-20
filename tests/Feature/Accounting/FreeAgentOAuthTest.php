<?php

declare(strict_types=1);

use App\Models\Tenant\GlAccount;
use App\Models\Tenant\IntegrationConfig;
use App\Models\Tenant\JournalEntry;
use App\Models\Tenant\User;
use App\Services\Accounting\FreeAgent\FreeAgentApiService;
use App\Services\Accounting\FreeAgent\FreeAgentOAuth2;
use App\Services\Accounting\FreeAgent\FreeAgentProvider;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;

beforeEach(function (): void {
    Config::set('services.freeagent.client_id', 'test-fa-client');
    Config::set('services.freeagent.client_secret', 'test-fa-secret');
    Config::set('services.freeagent.redirect_uri', 'https://tenant.test/accounting/integrations/freeagent/callback');
    Config::set('services.freeagent.api_base', 'https://api.freeagent.com/v2');
});

it('builds freeagent authorization url when configured', function (): void {
    $oauth = app(FreeAgentOAuth2::class);

    expect($oauth->isConfigured())->toBeTrue();

    $url = $oauth->getAuthorizationUrl('state-fa');

    expect($url)
        ->toContain('api.freeagent.com/v2/approve_app')
        ->toContain('client_id=test-fa-client')
        ->toContain('state=state-fa');
});

it('connects freeagent from oauth code and stores encrypted credentials', function (): void {
    Http::fake([
        'api.freeagent.com/v2/token_endpoint' => Http::response([
            'access_token' => 'fa-access',
            'refresh_token' => 'fa-refresh',
            'expires_in' => 3600,
            'token_type' => 'Bearer',
        ], 200),
        'api.freeagent.com/v2/company' => Http::response([
            'company' => [
                'id' => 42,
                'name' => 'Landlord Co',
            ],
        ], 200),
    ]);

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'FreeAgent OAuth '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@freeagent-oauth.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();

    $config = app(FreeAgentApiService::class)->connectFromCode('fa-code', (int) $user->id);

    expect($config)->not->toBeNull()
        ->and($config->provider)->toBe('freeagent')
        ->and($config->is_active)->toBeTrue();

    $credentials = $config->credentials_encrypted;
    expect($credentials['access_token'])->toBe('fa-access')
        ->and($credentials['refresh_token'])->toBe('fa-refresh');

    expect($config->settings['organisation_name'])->toBe('Landlord Co')
        ->and($config->settings['organisation_id'])->toBe('42');

    tenancy()->end();
});

it('pulls freeagent invoices into draft journal entries when connected', function (): void {
    Http::fake([
        'api.freeagent.com/v2/invoices*' => Http::response([
            'invoices' => [
                [
                    'url' => 'https://api.freeagent.com/v2/invoices/99',
                    'reference' => 'FA-99',
                    'dated_on' => '2026-02-01',
                    'total_value' => '120.00',
                    'contact_name' => 'Renter',
                ],
            ],
        ], 200),
    ]);

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'FreeAgent Pull '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@freeagent-pull.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    GlAccount::query()->firstOrCreate(
        ['code' => '4000'],
        ['name' => 'Sales', 'type' => 'income', 'is_active' => true]
    );
    GlAccount::query()->firstOrCreate(
        ['code' => '1100'],
        ['name' => 'Debtors', 'type' => 'asset', 'is_active' => true]
    );

    IntegrationConfig::query()->create([
        'tenant_id' => (string) tenant('id'),
        'provider' => 'freeagent',
        'credentials_encrypted' => [
            'access_token' => 'token',
            'refresh_token' => 'refresh',
            'api_base' => 'https://api.freeagent.com/v2',
            'token_type' => 'Bearer',
            'expires_at' => now()->addHour()->toIso8601String(),
        ],
        'settings' => ['organisation_name' => 'Landlord Co'],
        'is_active' => true,
    ]);

    $result = app(FreeAgentProvider::class)->pullInvoices();

    expect($result['pulled'])->toBe(1)
        ->and(JournalEntry::query()->where('integration_metadata->external_invoice_id', '99')->exists())->toBeTrue();

    tenancy()->end();
});
