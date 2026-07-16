<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Facades\Http;

it('serves journal create at journals/create without treating create as an entry id', function (): void {
    Http::preventStrayRequests();

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Accounting Web '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@accounting-web.test',
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

    $this->get('http://'.$host.'/accounting/journals/create')
        ->assertOk()
        ->assertSee('New draft journal')
        ->assertSee('Journal header property');

    $this->get('http://'.$host.'/accounting')
        ->assertOk()
        ->assertSee('Journal entries');

    $this->get('http://'.$host.'/accounting/chart')
        ->assertOk()
        ->assertSee('Chart of accounts');

    $this->get('http://'.$host.'/accounting/trial-balance')
        ->assertOk()
        ->assertSee('Trial balance');

    $this->get('http://'.$host.'/accounting/profit-and-loss')
        ->assertOk()
        ->assertSee('Property profit and loss');

    $this->get('http://'.$host.'/accounting/balance-sheet')
        ->assertOk()
        ->assertSee('Balance sheet');

    $this->get('http://'.$host.'/accounting/income-statement')
        ->assertOk()
        ->assertSee('Income statement');

    $this->get('http://'.$host.'/accounting/expenses')
        ->assertOk()
        ->assertSee('Expenses');

    $this->get('http://'.$host.'/accounting/ledger')
        ->assertOk()
        ->assertSee('Account ledger');
});

it('denies journal create page to external_accountant', function (): void {
    Http::preventStrayRequests();

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Accounting Web RO '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@accounting-web-ro.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->slug.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'accounting')->update(['enabled' => true]);
    completeTenantWorkspaceOnboarding();

    $readonly = User::factory()->create([
        'email' => 'readonly-'.uniqid().'@accounting-web-ro.test',
        'name' => 'Read Only',
    ]);
    $readonly->syncRoles(['external_accountant']);
    tenancy()->end();

    $this->actingAs($readonly, 'web');

    $this->get('http://'.$host.'/accounting/journals/create')->assertForbidden();

    $this->get('http://'.$host.'/accounting/ledger')->assertOk();
    $this->get('http://'.$host.'/accounting/balance-sheet')->assertOk();
    $this->get('http://'.$host.'/accounting/income-statement')->assertOk();
    $this->get('http://'.$host.'/accounting/chart')->assertOk();
    $this->get('http://'.$host.'/accounting')->assertOk();
});

it('serves journal show and edit for a draft', function (): void {
    Http::preventStrayRequests();

    $ownerEmail = 'owner-'.uniqid().'@accounting-web-draft.test';

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Accounting Web Draft '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => $ownerEmail,
        'plan' => 'starter',
    ]);

    $host = $tenant->slug.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'accounting')->update(['enabled' => true]);
    completeTenantWorkspaceOnboarding();
    $user = User::query()->where('email', $ownerEmail)->firstOrFail();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $byCode = collect($this->getJson('http://'.$host.'/api/accounting/accounts')->assertOk()->json('data'))->keyBy('code');
    $bankId = (int) $byCode['1000']['id'];
    $incomeId = (int) $byCode['4000']['id'];

    $create = $this->postJson('http://'.$host.'/api/accounting/journal-entries', [
        'entry_date' => now()->format('Y-m-d'),
        'reference' => 'WEB-DRAFT',
        'lines' => [
            ['gl_account_id' => $bankId, 'debit_minor' => 8000, 'credit_minor' => 0],
            ['gl_account_id' => $incomeId, 'debit_minor' => 0, 'credit_minor' => 8000],
        ],
    ]);
    $create->assertCreated();
    $entryId = (int) $create->json('data.id');

    $this->get('http://'.$host.'/accounting/journal/'.$entryId)
        ->assertOk()
        ->assertSee('DRAFT');

    $this->get('http://'.$host.'/accounting/journal/'.$entryId.'/edit')
        ->assertOk()
        ->assertSee('Edit draft journal');
});

it('returns 403 for edit page when journal is posted', function (): void {
    Http::preventStrayRequests();

    $ownerEmail = 'owner-'.uniqid().'@accounting-web-posted.test';

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Accounting Web Posted '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => $ownerEmail,
        'plan' => 'starter',
    ]);

    $host = $tenant->slug.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'accounting')->update(['enabled' => true]);
    completeTenantWorkspaceOnboarding();
    $user = User::query()->where('email', $ownerEmail)->firstOrFail();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $byCode = collect($this->getJson('http://'.$host.'/api/accounting/accounts')->assertOk()->json('data'))->keyBy('code');
    $bankId = (int) $byCode['1000']['id'];
    $incomeId = (int) $byCode['4000']['id'];

    $create = $this->postJson('http://'.$host.'/api/accounting/journal-entries', [
        'entry_date' => now()->format('Y-m-d'),
        'reference' => 'WEB-POSTED',
        'lines' => [
            ['gl_account_id' => $bankId, 'debit_minor' => 9000, 'credit_minor' => 0],
            ['gl_account_id' => $incomeId, 'debit_minor' => 0, 'credit_minor' => 9000],
        ],
    ]);
    $create->assertCreated();
    $entryId = (int) $create->json('data.id');
    $this->postJson('http://'.$host.'/api/accounting/journal-entries/'.$entryId.'/post')->assertOk();

    $this->get('http://'.$host.'/accounting/journal/'.$entryId.'/edit')->assertForbidden();
});
