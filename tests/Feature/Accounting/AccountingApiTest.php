<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\GlAccount;
use App\Models\Tenant\JournalEntry;
use App\Models\Tenant\Property;
use App\Models\Tenant\TenantRole;
use App\Models\Tenant\User;
use App\Services\Accounting\ChartOfAccountsService;
use App\Services\Accounting\JournalPostingService;
use App\Services\Billing\Contracts\FeatureGatingServiceInterface;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Facades\Http;
use Spatie\Permission\PermissionRegistrar;

it('seeds chart of accounts, accepts balanced journals, posts, and serves trial balance', function (): void {
    Http::preventStrayRequests();

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Accounting API '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@accounting-api.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->slug.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'accounting')->update(['enabled' => true]);

    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    app(PermissionRegistrar::class)->forgetCachedPermissions();
    $adminRole = TenantRole::query()->where('name', 'tenant_admin')->where('guard_name', 'web')->first();
    expect($adminRole)->not->toBeNull();
    expect($adminRole->permissions->pluck('name')->all())->toContain('view-accounting', 'manage-accounting');
    expect($user->fresh()->hasRole('tenant_admin'))->toBeTrue()
        ->and($user->fresh()->can('view-accounting'))->toBeTrue();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $accounts = $this->getJson('http://'.$host.'/api/accounting/accounts');
    $accounts->assertOk();
    expect($accounts->json('data'))->not->toBeEmpty();

    $byCode = collect($accounts->json('data'))->keyBy('code');
    $bankId = (int) $byCode['1000']['id'];
    $incomeId = (int) $byCode['4000']['id'];

    $create = $this->postJson('http://'.$host.'/api/accounting/journal-entries', [
        'entry_date' => now()->format('Y-m-d'),
        'reference' => 'INV-TEST-'.uniqid(),
        'description' => 'Test rental recognition',
        'integration_metadata' => ['xero' => ['invoice_id' => 'inv-123']],
        'lines' => [
            ['gl_account_id' => $bankId, 'debit_minor' => 120000, 'credit_minor' => 0, 'memo' => 'Tenant payment', 'vat_treatment' => 'standard'],
            ['gl_account_id' => $incomeId, 'debit_minor' => 0, 'credit_minor' => 120000, 'memo' => 'Rental income', 'vat_treatment' => 'exempt'],
        ],
    ]);

    $create->assertCreated()
        ->assertJsonPath('data.status', 'draft')
        ->assertJsonPath('data.integration_metadata.xero.invoice_id', 'inv-123')
        ->assertJsonPath('data.lines.0.vat_treatment', 'standard')
        ->assertJsonPath('data.lines.1.vat_treatment', 'exempt');

    $entryId = (int) $create->json('data.id');
    expect($entryId)->toBeGreaterThan(0);

    $bad = $this->postJson('http://'.$host.'/api/accounting/journal-entries', [
        'entry_date' => now()->format('Y-m-d'),
        'lines' => [
            ['gl_account_id' => $bankId, 'debit_minor' => 100, 'credit_minor' => 0],
            ['gl_account_id' => $incomeId, 'debit_minor' => 0, 'credit_minor' => 200],
        ],
    ]);
    $bad->assertStatus(422);

    $badVat = $this->postJson('http://'.$host.'/api/accounting/journal-entries', [
        'entry_date' => now()->format('Y-m-d'),
        'lines' => [
            ['gl_account_id' => $bankId, 'debit_minor' => 100, 'credit_minor' => 0, 'vat_treatment' => 'not_a_real_vat_code'],
            ['gl_account_id' => $incomeId, 'debit_minor' => 0, 'credit_minor' => 100],
        ],
    ]);
    $badVat->assertStatus(422);

    $post = $this->postJson('http://'.$host.'/api/accounting/journal-entries/'.$entryId.'/post');
    $post->assertOk()->assertJsonPath('data.status', 'posted');

    $tb = $this->getJson('http://'.$host.'/api/accounting/trial-balance?as_of='.now()->format('Y-m-d'));
    $tb->assertOk();
    $lines = $tb->json('data.lines');
    expect($lines)->toBeArray()->not->toBeEmpty();
    expect(collect($lines)->sum('debit_minor'))->toBe(collect($lines)->sum('credit_minor'));

    $fromAct = now()->subDay()->format('Y-m-d');
    $toAct = now()->addDay()->format('Y-m-d');
    $bankActivity = $this->getJson('http://'.$host.'/api/accounting/accounts/'.$bankId.'/activity?from='.$fromAct.'&to='.$toAct);
    $bankActivity->assertOk();
    expect($bankActivity->json('data.lines'))->toHaveCount(1);
    expect((int) $bankActivity->json('data.closing_balance_minor'))->toBe(120000);
    expect((int) $bankActivity->json('data.lines.0.signed_movement_minor'))->toBe(120000);

    $incomeActivity = $this->getJson('http://'.$host.'/api/accounting/accounts/'.$incomeId.'/activity?from='.$fromAct.'&to='.$toAct);
    $incomeActivity->assertOk();
    expect((int) $incomeActivity->json('data.closing_balance_minor'))->toBe(120000);
    expect((int) $incomeActivity->json('data.lines.0.signed_movement_minor'))->toBe(120000);

    $csvAccounts = $this->get('http://'.$host.'/api/accounting/exports/accounts.csv');
    $csvAccounts->assertOk();
    expect(str_contains($csvAccounts->streamedContent(), 'code,name,type'))->toBeTrue();

    $csvJournals = $this->get('http://'.$host.'/api/accounting/exports/journal-entries.csv');
    $csvJournals->assertOk();
    $journalCsv = $csvJournals->streamedContent();
    expect(str_contains($journalCsv, 'journal_id,entry_date'))->toBeTrue();
    expect(str_contains($journalCsv, 'line_property_id'))->toBeTrue();
    expect(str_contains($journalCsv, 'integration_metadata_json'))->toBeTrue();
    expect(str_contains($journalCsv, 'vat_treatment'))->toBeTrue();

    $csvTb = $this->get('http://'.$host.'/api/accounting/exports/trial-balance.csv?as_of='.now()->format('Y-m-d'));
    $csvTb->assertOk();
    expect(str_contains($csvTb->streamedContent(), 'gl_account_id'))->toBeTrue();

    tenancy()->initialize($tenant);
    expect(JournalEntry::query()->where('status', 'posted')->count())->toBeGreaterThan(0);
    expect(GlAccount::query()->where('code', '1000')->exists())->toBeTrue();
    tenancy()->end();
});

it('returns 422 for gl account activity when date range exceeds 366 days', function (): void {
    Http::preventStrayRequests();

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Accounting ActRange '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@accounting-actrange.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->slug.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'accounting')->update(['enabled' => true]);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $accounts = $this->getJson('http://'.$host.'/api/accounting/accounts');
    $accounts->assertOk();
    $bankId = (int) collect($accounts->json('data'))->firstWhere('code', '1000')['id'];

    $from = now()->subDays(400)->format('Y-m-d');
    $to = now()->format('Y-m-d');
    $this->getJson('http://'.$host.'/api/accounting/accounts/'.$bankId.'/activity?from='.$from.'&to='.$to)
        ->assertStatus(422);
});

it('returns 422 for gl account activity when from or to is missing', function (): void {
    Http::preventStrayRequests();

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Accounting ActVal '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@accounting-actval.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->slug.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'accounting')->update(['enabled' => true]);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $bankId = (int) collect($this->getJson('http://'.$host.'/api/accounting/accounts')->assertOk()->json('data'))->firstWhere('code', '1000')['id'];

    $this->getJson('http://'.$host.'/api/accounting/accounts/'.$bankId.'/activity')
        ->assertStatus(422);
});

it('includes prior posted activity in gl account opening balance', function (): void {
    Http::preventStrayRequests();

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Accounting Opening '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@accounting-opening.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->slug.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'accounting')->update(['enabled' => true]);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $accounts = $this->getJson('http://'.$host.'/api/accounting/accounts');
    $accounts->assertOk();
    $byCode = collect($accounts->json('data'))->keyBy('code');
    $bankId = (int) $byCode['1000']['id'];
    $incomeId = (int) $byCode['4000']['id'];

    $pastDate = now()->subDays(10)->format('Y-m-d');
    $first = $this->postJson('http://'.$host.'/api/accounting/journal-entries', [
        'entry_date' => $pastDate,
        'reference' => 'OPEN-1',
        'lines' => [
            ['gl_account_id' => $bankId, 'debit_minor' => 30000, 'credit_minor' => 0],
            ['gl_account_id' => $incomeId, 'debit_minor' => 0, 'credit_minor' => 30000],
        ],
    ]);
    $first->assertCreated();
    $this->postJson('http://'.$host.'/api/accounting/journal-entries/'.(int) $first->json('data.id').'/post')->assertOk();

    $second = $this->postJson('http://'.$host.'/api/accounting/journal-entries', [
        'entry_date' => now()->format('Y-m-d'),
        'reference' => 'OPEN-2',
        'lines' => [
            ['gl_account_id' => $bankId, 'debit_minor' => 20000, 'credit_minor' => 0],
            ['gl_account_id' => $incomeId, 'debit_minor' => 0, 'credit_minor' => 20000],
        ],
    ]);
    $second->assertCreated();
    $this->postJson('http://'.$host.'/api/accounting/journal-entries/'.(int) $second->json('data.id').'/post')->assertOk();

    $today = now()->format('Y-m-d');
    $activity = $this->getJson('http://'.$host.'/api/accounting/accounts/'.$bankId.'/activity?from='.$today.'&to='.$today);
    $activity->assertOk();
    expect((int) $activity->json('data.opening_balance_minor'))->toBe(30000);
    expect($activity->json('data.lines'))->toHaveCount(1);
    expect((int) $activity->json('data.closing_balance_minor'))->toBe(50000);
});

it('returns 422 for property profit and loss when from is after to', function (): void {
    Http::preventStrayRequests();

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Accounting PnL422 '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@accounting-pnl422.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->slug.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'accounting')->update(['enabled' => true]);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = Property::query()->create([
        'address_line1' => '1 Bad Range Rd',
        'city' => 'Leeds',
        'postcode' => 'LS1 1AA',
        'property_type' => 'flat',
        'created_by' => $user->id,
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->getJson('http://'.$host.'/api/accounting/properties/'.$property->id.'/profit-and-loss?from='.now()->format('Y-m-d').'&to='.now()->subDay()->format('Y-m-d'))
        ->assertStatus(422);
});

it('returns 403 for accounting api when subscription denies accounting module', function (): void {
    Http::preventStrayRequests();

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Accounting Gate '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@accounting-gate.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->slug.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'accounting')->update(['enabled' => true]);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => true]);

    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $mock = mock(FeatureGatingServiceInterface::class);
    $mock->shouldReceive('hasFeature')
        ->zeroOrMoreTimes()
        ->andReturnUsing(fn (string $tid, string $feature): bool => $feature !== 'accounting');
    $this->app->instance(FeatureGatingServiceInterface::class, $mock);

    $this->actingAs($user, 'web');

    $this->getJson('http://'.$host.'/api/accounting/accounts')->assertStatus(403);
});

it('aggregates property profit and loss from posted journals with property_id', function (): void {
    Http::preventStrayRequests();

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Accounting PnL '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@accounting-pnl.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->slug.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'accounting')->update(['enabled' => true]);

    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = Property::query()->create([
        'address_line1' => '10 Ledger Lane',
        'city' => 'Manchester',
        'postcode' => 'M1 1AA',
        'property_type' => 'terraced',
        'created_by' => $user->id,
    ]);

    $bankId = (int) GlAccount::query()->where('code', '1000')->value('id');
    $incomeId = (int) GlAccount::query()->where('code', '4000')->value('id');
    $expenseId = (int) GlAccount::query()->where('code', '5000')->value('id');

    $entry = JournalEntry::query()->create([
        'entry_date' => now()->toDateString(),
        'reference' => 'PROP-PNL-1',
        'description' => 'Rent and repair',
        'status' => JournalEntry::STATUS_DRAFT,
        'property_id' => $property->id,
        'deal_analysis_id' => null,
        'user_id' => $user->id,
    ]);
    $entry->lines()->createMany([
        ['gl_account_id' => $bankId, 'memo' => 'Cash in', 'debit_minor' => 80000, 'credit_minor' => 0, 'sort_order' => 0],
        ['gl_account_id' => $incomeId, 'memo' => 'Rent', 'debit_minor' => 0, 'credit_minor' => 60000, 'sort_order' => 1],
        ['gl_account_id' => $expenseId, 'memo' => 'Repair', 'debit_minor' => 20000, 'credit_minor' => 0, 'sort_order' => 2],
    ]);
    $entry->update([
        'status' => JournalEntry::STATUS_POSTED,
        'posted_at' => now(),
    ]);

    tenancy()->end();

    $this->actingAs($user, 'web');

    $pnl = $this->getJson('http://'.$host.'/api/accounting/properties/'.$property->id.'/profit-and-loss?from='.now()->subDay()->format('Y-m-d').'&to='.now()->addDay()->format('Y-m-d'));
    $pnl->assertOk();
    $pnl->assertJsonPath('data.property_id', $property->id);
    expect((int) $pnl->json('data.income_minor'))->toBe(60000);
    expect((int) $pnl->json('data.expense_minor'))->toBe(20000);
    expect((int) $pnl->json('data.net_operating_minor'))->toBe(40000);
});

it('aggregates property P&L from line-level property_id on a split journal', function (): void {
    Http::preventStrayRequests();

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Accounting Split '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@accounting-split.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->slug.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'accounting')->update(['enabled' => true]);

    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $propA = Property::query()->create([
        'address_line1' => '1 Split Street',
        'city' => 'Leeds',
        'postcode' => 'LS1 1AA',
        'property_type' => 'terraced',
        'created_by' => $user->id,
    ]);
    $propB = Property::query()->create([
        'address_line1' => '2 Split Street',
        'city' => 'Leeds',
        'postcode' => 'LS1 1AB',
        'property_type' => 'terraced',
        'created_by' => $user->id,
    ]);

    $bankId = (int) GlAccount::query()->where('code', '1000')->value('id');
    $expenseId = (int) GlAccount::query()->where('code', '5000')->value('id');

    $entry = JournalEntry::query()->create([
        'entry_date' => now()->toDateString(),
        'reference' => 'SPLIT-1',
        'description' => 'Shared supplier payment',
        'status' => JournalEntry::STATUS_DRAFT,
        'property_id' => null,
        'deal_analysis_id' => null,
        'user_id' => $user->id,
    ]);
    $entry->lines()->createMany([
        ['gl_account_id' => $expenseId, 'property_id' => $propA->id, 'memo' => 'Repairs A', 'debit_minor' => 6000, 'credit_minor' => 0, 'sort_order' => 0],
        ['gl_account_id' => $expenseId, 'property_id' => $propB->id, 'memo' => 'Repairs B', 'debit_minor' => 4000, 'credit_minor' => 0, 'sort_order' => 1],
        ['gl_account_id' => $bankId, 'property_id' => null, 'memo' => 'Bank', 'debit_minor' => 0, 'credit_minor' => 10000, 'sort_order' => 2],
    ]);
    $entry->update([
        'status' => JournalEntry::STATUS_POSTED,
        'posted_at' => now(),
    ]);

    tenancy()->end();

    $this->actingAs($user, 'web');

    $from = now()->subDay()->format('Y-m-d');
    $to = now()->addDay()->format('Y-m-d');

    $pnlA = $this->getJson('http://'.$host.'/api/accounting/properties/'.$propA->id.'/profit-and-loss?from='.$from.'&to='.$to);
    $pnlA->assertOk();
    expect((int) $pnlA->json('data.expense_minor'))->toBe(6000);

    $pnlB = $this->getJson('http://'.$host.'/api/accounting/properties/'.$propB->id.'/profit-and-loss?from='.$from.'&to='.$to);
    $pnlB->assertOk();
    expect((int) $pnlB->json('data.expense_minor'))->toBe(4000);
});

it('persists optional property_id on journal lines via the api', function (): void {
    Http::preventStrayRequests();

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Accounting LineProp '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@accounting-lineprop.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->slug.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'accounting')->update(['enabled' => true]);

    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = Property::query()->create([
        'address_line1' => '99 API Lane',
        'city' => 'Bristol',
        'postcode' => 'BS1 1AA',
        'property_type' => 'flat',
        'created_by' => $user->id,
    ]);

    tenancy()->end();

    $this->actingAs($user, 'web');

    $accounts = $this->getJson('http://'.$host.'/api/accounting/accounts');
    $accounts->assertOk();
    $byCode = collect($accounts->json('data'))->keyBy('code');
    $bankId = (int) $byCode['1000']['id'];
    $incomeId = (int) $byCode['4000']['id'];

    $create = $this->postJson('http://'.$host.'/api/accounting/journal-entries', [
        'entry_date' => now()->format('Y-m-d'),
        'reference' => 'LINE-P-'.uniqid(),
        'lines' => [
            ['gl_account_id' => $bankId, 'debit_minor' => 5000, 'credit_minor' => 0, 'property_id' => $property->id],
            ['gl_account_id' => $incomeId, 'debit_minor' => 0, 'credit_minor' => 5000, 'property_id' => $property->id],
        ],
    ]);

    $create->assertCreated();
    $entryId = (int) $create->json('data.id');
    expect((int) $create->json('data.lines.0.property_id'))->toBe($property->id);
    expect((int) $create->json('data.lines.1.property_id'))->toBe($property->id);

    $show = $this->getJson('http://'.$host.'/api/accounting/journal-entries/'.$entryId);
    $show->assertOk();
    expect((int) $show->json('data.lines.0.property_id'))->toBe($property->id);
});

it('updates a draft journal via put', function (): void {
    Http::preventStrayRequests();

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Accounting Update '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@accounting-update.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->slug.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'accounting')->update(['enabled' => true]);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = Property::query()->create([
        'address_line1' => '7 Edit Lane',
        'city' => 'Sheffield',
        'postcode' => 'S1 1AA',
        'property_type' => 'terraced',
        'created_by' => $user->id,
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');

    $accounts = $this->getJson('http://'.$host.'/api/accounting/accounts');
    $accounts->assertOk();
    $byCode = collect($accounts->json('data'))->keyBy('code');
    $bankId = (int) $byCode['1000']['id'];
    $incomeId = (int) $byCode['4000']['id'];

    $create = $this->postJson('http://'.$host.'/api/accounting/journal-entries', [
        'entry_date' => now()->format('Y-m-d'),
        'reference' => 'DRAFT-EDIT-1',
        'lines' => [
            ['gl_account_id' => $bankId, 'debit_minor' => 10000, 'credit_minor' => 0],
            ['gl_account_id' => $incomeId, 'debit_minor' => 0, 'credit_minor' => 10000],
        ],
    ]);
    $create->assertCreated();
    $entryId = (int) $create->json('data.id');

    $put = $this->putJson('http://'.$host.'/api/accounting/journal-entries/'.$entryId, [
        'entry_date' => now()->format('Y-m-d'),
        'reference' => 'DRAFT-EDIT-UPDATED',
        'lines' => [
            ['gl_account_id' => $bankId, 'debit_minor' => 15000, 'credit_minor' => 0, 'property_id' => $property->id],
            ['gl_account_id' => $incomeId, 'debit_minor' => 0, 'credit_minor' => 15000, 'property_id' => $property->id],
        ],
    ]);
    $put->assertOk();
    expect($put->json('data.reference'))->toBe('DRAFT-EDIT-UPDATED');
    expect((int) $put->json('data.lines.0.debit_minor'))->toBe(15000);
    expect((int) $put->json('data.lines.0.property_id'))->toBe($property->id);
    expect((int) $put->json('data.lines.1.property_id'))->toBe($property->id);
});

it('returns 403 when updating a posted journal', function (): void {
    Http::preventStrayRequests();

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Accounting NoUpdate '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@accounting-noupdate.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->slug.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'accounting')->update(['enabled' => true]);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $accounts = $this->getJson('http://'.$host.'/api/accounting/accounts');
    $accounts->assertOk();
    $byCode = collect($accounts->json('data'))->keyBy('code');
    $bankId = (int) $byCode['1000']['id'];
    $incomeId = (int) $byCode['4000']['id'];

    $create = $this->postJson('http://'.$host.'/api/accounting/journal-entries', [
        'entry_date' => now()->format('Y-m-d'),
        'reference' => 'POSTED-LOCK',
        'lines' => [
            ['gl_account_id' => $bankId, 'debit_minor' => 5000, 'credit_minor' => 0],
            ['gl_account_id' => $incomeId, 'debit_minor' => 0, 'credit_minor' => 5000],
        ],
    ]);
    $create->assertCreated();
    $entryId = (int) $create->json('data.id');
    $this->postJson('http://'.$host.'/api/accounting/journal-entries/'.$entryId.'/post')->assertOk();

    $put = $this->putJson('http://'.$host.'/api/accounting/journal-entries/'.$entryId, [
        'entry_date' => now()->format('Y-m-d'),
        'reference' => 'SHOULD-FAIL',
        'lines' => [
            ['gl_account_id' => $bankId, 'debit_minor' => 5000, 'credit_minor' => 0],
            ['gl_account_id' => $incomeId, 'debit_minor' => 0, 'credit_minor' => 5000],
        ],
    ]);
    $put->assertForbidden();
});

it('denies journal writes to external_accountant while allowing read exports', function (): void {
    Http::preventStrayRequests();

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Accounting RO '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@accounting-ro.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->slug.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'accounting')->update(['enabled' => true]);
    completeTenantWorkspaceOnboarding();

    $readonly = User::factory()->create([
        'email' => 'readonly-'.uniqid().'@accounting-ro.test',
        'name' => 'Read Only',
    ]);
    $readonly->syncRoles(['external_accountant']);

    $owner = User::query()->where('email', 'like', 'owner-%@accounting-ro.test')->firstOrFail();
    app(ChartOfAccountsService::class)->ensureDefaultAccounts();
    $bankIdOwner = (int) GlAccount::query()->where('code', '1000')->value('id');
    $incomeIdOwner = (int) GlAccount::query()->where('code', '4000')->value('id');
    $draftForPut = app(JournalPostingService::class)->createDraft(
        now()->format('Y-m-d'),
        [
            ['gl_account_id' => $bankIdOwner, 'debit_minor' => 100, 'credit_minor' => 0],
            ['gl_account_id' => $incomeIdOwner, 'debit_minor' => 0, 'credit_minor' => 100],
        ],
        'RO-DRAFT-PUT',
        null,
        null,
        null,
        $owner->id,
    );
    $draftPutId = (int) $draftForPut->getKey();

    tenancy()->end();

    $this->actingAs($readonly, 'web');

    $this->putJson('http://'.$host.'/api/accounting/journal-entries/'.$draftPutId, [
        'entry_date' => now()->format('Y-m-d'),
        'reference' => 'SHOULD-DENY',
        'lines' => [
            ['gl_account_id' => $bankIdOwner, 'debit_minor' => 100, 'credit_minor' => 0],
            ['gl_account_id' => $incomeIdOwner, 'debit_minor' => 0, 'credit_minor' => 100],
        ],
    ])->assertForbidden();

    $this->getJson('http://'.$host.'/api/accounting/accounts')->assertOk();
    $this->get('http://'.$host.'/api/accounting/exports/accounts.csv')->assertOk();

    $bankId = (int) collect($this->getJson('http://'.$host.'/api/accounting/accounts')->json('data'))->firstWhere('code', '1000')['id'];
    $from = now()->subDay()->format('Y-m-d');
    $to = now()->addDay()->format('Y-m-d');
    $this->getJson('http://'.$host.'/api/accounting/accounts/'.$bankId.'/activity?from='.$from.'&to='.$to)->assertOk();
    $this->getJson('http://'.$host.'/api/accounting/journal-entries')->assertOk();
    $this->getJson('http://'.$host.'/api/accounting/trial-balance?as_of='.now()->format('Y-m-d'))->assertOk();

    $this->postJson('http://'.$host.'/api/accounting/journal-entries', [
        'entry_date' => now()->format('Y-m-d'),
        'lines' => [
            ['gl_account_id' => 1, 'debit_minor' => 100, 'credit_minor' => 0],
            ['gl_account_id' => 2, 'debit_minor' => 0, 'credit_minor' => 100],
        ],
    ])->assertStatus(403);

    $this->postJson('http://'.$host.'/api/accounting/accounts', [
        'code' => '9999-RO',
        'name' => 'Blocked custom',
        'type' => 'expense',
    ])->assertForbidden();
});
