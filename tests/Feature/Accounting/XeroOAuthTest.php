<?php

declare(strict_types=1);

use App\Models\Tenant\GlAccount;
use App\Models\Tenant\IntegrationConfig;
use App\Models\Tenant\JournalEntry;
use App\Models\Tenant\JournalLine;
use App\Models\Tenant\User;
use App\Services\Accounting\Xero\XeroApiService;
use App\Services\Accounting\Xero\XeroOAuth2;
use App\Services\Accounting\Xero\XeroProvider;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;

beforeEach(function (): void {
    Config::set('services.xero.client_id', 'test-xero-client');
    Config::set('services.xero.client_secret', 'test-xero-secret');
    Config::set('services.xero.redirect_uri', 'https://tenant.test/accounting/integrations/xero/callback');
});

it('builds xero authorization url when configured', function (): void {
    $oauth = app(XeroOAuth2::class);

    expect($oauth->isConfigured())->toBeTrue();

    $url = $oauth->getAuthorizationUrl('state-abc');

    expect($url)
        ->toContain('login.xero.com/identity/connect/authorize')
        ->toContain('client_id=test-xero-client')
        ->toContain('state=state-abc');
});

it('connects xero from oauth code and stores encrypted credentials', function (): void {
    Http::fake([
        'identity.xero.com/connect/token' => Http::response([
            'access_token' => 'access-xyz',
            'refresh_token' => 'refresh-xyz',
            'expires_in' => 1800,
            'token_type' => 'Bearer',
        ], 200),
        'api.xero.com/connections' => Http::response([
            [
                'tenantId' => 'tenant-uuid-1',
                'tenantName' => 'Demo Org',
                'tenantType' => 'ORGANISATION',
            ],
        ], 200),
    ]);

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Xero OAuth '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@xero-oauth.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();

    $config = app(XeroApiService::class)->connectFromCode('auth-code-123', (int) $user->id);

    expect($config)->not->toBeNull()
        ->and($config->provider)->toBe('xero')
        ->and($config->is_active)->toBeTrue();

    $credentials = $config->credentials_encrypted;
    expect($credentials['access_token'])->toBe('access-xyz')
        ->and($credentials['refresh_token'])->toBe('refresh-xyz')
        ->and($credentials['tenant_id'])->toBe('tenant-uuid-1');

    expect($config->settings['organisation_name'])->toBe('Demo Org');

    tenancy()->end();
});

it('pulls xero invoices into draft journal entries when connected', function (): void {
    Http::fake([
        'api.xero.com/api.xro/2.0/Invoices*' => Http::response([
            'Invoices' => [
                [
                    'InvoiceID' => 'inv-100',
                    'InvoiceNumber' => 'INV-100',
                    'Date' => '2026-01-15',
                    'Total' => 250.50,
                    'Contact' => ['Name' => 'Tenant Ltd', 'ContactID' => 'contact-1'],
                ],
            ],
        ], 200),
    ]);

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Xero Pull '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@xero-pull.test',
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
        'provider' => 'xero',
        'credentials_encrypted' => [
            'access_token' => 'token',
            'refresh_token' => 'refresh',
            'tenant_id' => 'tenant-uuid-1',
            'token_type' => 'Bearer',
            'expires_at' => now()->addHour()->toIso8601String(),
        ],
        'settings' => ['organisation_name' => 'Demo Org'],
        'is_active' => true,
    ]);

    $result = app(XeroProvider::class)->pullInvoices();

    expect($result['pulled'])->toBe(1)
        ->and(JournalEntry::query()->where('integration_metadata->external_invoice_id', 'inv-100')->exists())->toBeTrue();

    tenancy()->end();
});

it('pushes posted journals to xero as invoices', function (): void {
    Http::fake([
        'api.xero.com/api.xro/2.0/Invoices' => Http::response([
            'Invoices' => [
                ['InvoiceID' => 'created-inv-1'],
            ],
        ], 200),
    ]);

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Xero Push '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@xero-push.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    $sales = GlAccount::query()->firstOrCreate(
        ['code' => '4000'],
        ['name' => 'Sales', 'type' => 'income', 'is_active' => true]
    );
    $debtors = GlAccount::query()->firstOrCreate(
        ['code' => '1100'],
        ['name' => 'Debtors', 'type' => 'asset', 'is_active' => true]
    );

    IntegrationConfig::query()->create([
        'tenant_id' => (string) tenant('id'),
        'provider' => 'xero',
        'credentials_encrypted' => [
            'access_token' => 'token',
            'refresh_token' => 'refresh',
            'tenant_id' => 'tenant-uuid-1',
            'token_type' => 'Bearer',
            'expires_at' => now()->addHour()->toIso8601String(),
        ],
        'settings' => [],
        'is_active' => true,
    ]);

    $userId = (int) User::query()->value('id');

    $entry = JournalEntry::query()->create([
        'entry_date' => now()->toDateString(),
        'status' => 'posted',
        'reference' => 'JE-TEST',
        'description' => 'Push test',
        'user_id' => $userId,
    ]);

    JournalLine::query()->create([
        'journal_entry_id' => $entry->id,
        'gl_account_id' => $debtors->id,
        'memo' => 'Debit',
        'debit_minor' => 10000,
        'credit_minor' => 0,
        'sort_order' => 0,
    ]);
    JournalLine::query()->create([
        'journal_entry_id' => $entry->id,
        'gl_account_id' => $sales->id,
        'memo' => 'Credit',
        'debit_minor' => 0,
        'credit_minor' => 10000,
        'sort_order' => 1,
    ]);

    $result = app(XeroProvider::class)->pushJournals([$entry->id]);

    expect($result['pushed'])->toBe(1)
        ->and($entry->fresh()->integration_metadata['external_invoice_id'] ?? null)->toBe('created-inv-1');

    Http::assertSent(fn ($request) => str_contains($request->url(), '/Invoices')
        && $request->hasHeader('Xero-tenant-id', 'tenant-uuid-1'));

    tenancy()->end();
});
