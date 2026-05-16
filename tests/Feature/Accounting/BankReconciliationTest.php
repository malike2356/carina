<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\BankTransaction;
use App\Models\Tenant\GlAccount;
use App\Models\Tenant\JournalEntry;
use App\Models\Tenant\JournalLine;
use App\Models\Tenant\User;
use App\Services\Accounting\BankCsvImportService;
use App\Services\Accounting\BankReconciliationService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;

it('serves bank reconciliation for a tenant owner with accounting enabled', function (): void {
    Http::preventStrayRequests();

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Bank Recon Web '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@bank-recon-web.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->slug.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'accounting')->update(['enabled' => true]);
    completeTenantWorkspaceOnboarding();
    $user = User::query()->firstOrFail();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/accounting/reconciliation')
        ->assertOk()
        ->assertSee('Bank reconciliation');
});

it('imports a Barclays-style CSV via BankCsvImportService', function (): void {
    Http::preventStrayRequests();

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Bank Recon Import '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@bank-recon-import.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'accounting')->update(['enabled' => true]);
    completeTenantWorkspaceOnboarding();

    $bankId = (int) GlAccount::query()->where('code', '1000')->value('id');

    $csv = "Date,Description,Amount\n14/05/2026,Rent received,1250.00\n14/05/2026,Supplier payment,-50.25\n";
    $file = UploadedFile::fake()->createWithContent('statement.csv', $csv);

    $importer = app(BankCsvImportService::class);
    $result = $importer->import($file, $bankId);

    expect($result['error'])->toBeNull()
        ->and($result['imported'])->toBe(2)
        ->and($result['batch'])->not->toBeNull();

    expect(BankTransaction::query()->count())->toBe(2);

    $credit = BankTransaction::query()->where('description', 'Rent received')->first();
    expect($credit)->not->toBeNull()
        ->and($credit->amount_minor)->toBe(125000);

    $debit = BankTransaction::query()->where('description', 'Supplier payment')->first();
    expect($debit)->not->toBeNull()
        ->and($debit->amount_minor)->toBe(-5025);

    tenancy()->end();
});

it('auto-matches an imported inflow to a posted bank debit line', function (): void {
    Http::preventStrayRequests();

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Bank Recon Match '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@bank-recon-match.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'accounting')->update(['enabled' => true]);
    completeTenantWorkspaceOnboarding();

    $bankId = (int) GlAccount::query()->where('code', '1000')->value('id');
    $incomeId = (int) GlAccount::query()->where('code', '4000')->value('id');
    $userId = (int) User::query()->firstOrFail()->id;

    $entry = JournalEntry::query()->create([
        'entry_date' => '2026-05-14',
        'reference' => 'MATCH-TEST',
        'description' => 'Test rent',
        'status' => JournalEntry::STATUS_POSTED,
        'user_id' => $userId,
        'posted_at' => now(),
    ]);

    JournalLine::query()->create([
        'journal_entry_id' => $entry->id,
        'gl_account_id' => $bankId,
        'debit_minor' => 7500,
        'credit_minor' => 0,
        'sort_order' => 1,
    ]);

    JournalLine::query()->create([
        'journal_entry_id' => $entry->id,
        'gl_account_id' => $incomeId,
        'debit_minor' => 0,
        'credit_minor' => 7500,
        'sort_order' => 2,
    ]);

    $csv = "Date,Description,Amount\n14/05/2026,Tenant payment,75.00\n";
    $file = UploadedFile::fake()->createWithContent('match.csv', $csv);

    $importer = app(BankCsvImportService::class);
    $reconciler = app(BankReconciliationService::class);
    $result = $importer->import($file, $bankId);
    expect($result['imported'])->toBe(1);

    $matched = $reconciler->autoMatch((string) $result['batch']);
    expect($matched)->toBe(1);

    $tx = BankTransaction::query()->first();
    expect($tx)->not->toBeNull()
        ->and($tx->status)->toBe('matched')
        ->and($tx->matched_journal_line_id)->not->toBeNull();

    tenancy()->end();
});
