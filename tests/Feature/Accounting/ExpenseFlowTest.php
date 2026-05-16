<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\Expense;
use App\Models\Tenant\JournalEntry;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;

it('creates an expense and builds a draft journal linked to the expense', function (): void {
    Http::preventStrayRequests();

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Expense Flow '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@expense-flow.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->slug.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'accounting')->update(['enabled' => true]);
    completeTenantWorkspaceOnboarding();
    $user = User::query()->firstOrFail();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $byCode = collect($this->getJson('http://'.$host.'/api/accounting/accounts')->assertOk()->json('data'))->keyBy('code');
    $expenseGlId = (int) $byCode['5000']['id'];
    $bankId = (int) $byCode['1000']['id'];

    $this->get('http://'.$host.'/accounting/expenses')->assertOk()->assertSee('Expenses');

    $this->get('http://'.$host.'/accounting/expenses/create')->assertOk()->assertSee('Add expense');

    $post = $this->post('http://'.$host.'/accounting/expenses', [
        'expense_date' => now()->format('Y-m-d'),
        'amount_minor' => 12345,
        'description' => 'Test repair invoice',
        'expense_gl_account_id' => $expenseGlId,
        'credit_gl_account_id' => $bankId,
        'category' => 'repairs',
        'payment_method' => 'bank_transfer',
        'vendor_name' => 'Test Supplies Ltd',
    ]);
    $post->assertRedirect();

    tenancy()->initialize($tenant);
    $expense = Expense::query()->latest('id')->first();
    tenancy()->end();

    expect($expense)->not->toBeNull();
    expect($expense->amount_minor)->toBe(12345);
    expect($expense->journal_entry_id)->toBeNull();

    $this->post('http://'.$host.'/accounting/expenses/'.$expense->id.'/post-to-ledger')
        ->assertRedirect();

    tenancy()->initialize($tenant);
    $expense->refresh();
    expect($expense->journal_entry_id)->not->toBeNull();

    $je = JournalEntry::query()->findOrFail((int) $expense->journal_entry_id);
    expect($je->status)->toBe(JournalEntry::STATUS_DRAFT);
    expect($je->integration_metadata['source'] ?? null)->toBe('expense');
    expect((int) ($je->integration_metadata['expense_id'] ?? 0))->toBe((int) $expense->id);
    tenancy()->end();

    $this->get('http://'.$host.'/accounting/expenses/'.$expense->id)->assertOk()->assertSee('draft');
});

it('stores an optional receipt and allows download', function (): void {
    Http::preventStrayRequests();

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Expense Receipt '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@expense-receipt.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->slug.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'accounting')->update(['enabled' => true]);
    completeTenantWorkspaceOnboarding();
    $user = User::query()->firstOrFail();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $byCode = collect($this->getJson('http://'.$host.'/api/accounting/accounts')->assertOk()->json('data'))->keyBy('code');
    $expenseGlId = (int) $byCode['5000']['id'];

    $this->post('http://'.$host.'/accounting/expenses', [
        'expense_date' => now()->format('Y-m-d'),
        'amount_minor' => 5000,
        'description' => 'Receipt test',
        'expense_gl_account_id' => $expenseGlId,
        'category' => 'other',
        'receipt' => UploadedFile::fake()->create('invoice.pdf', 400, 'application/pdf'),
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $expense = Expense::query()->latest('id')->first();
    expect($expense->hasReceipt())->toBeTrue();
    $eid = (int) $expense->id;
    tenancy()->end();

    $this->get('http://'.$host.'/accounting/expenses/'.$eid.'/receipt')->assertOk();
});

it('posts journal immediately from an expense', function (): void {
    Http::preventStrayRequests();

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Expense PostNow '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@expense-postnow.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->slug.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'accounting')->update(['enabled' => true]);
    completeTenantWorkspaceOnboarding();
    $user = User::query()->firstOrFail();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $byCode = collect($this->getJson('http://'.$host.'/api/accounting/accounts')->assertOk()->json('data'))->keyBy('code');
    $expenseGlId = (int) $byCode['5000']['id'];
    $bankId = (int) $byCode['1000']['id'];

    $this->post('http://'.$host.'/accounting/expenses', [
        'expense_date' => now()->format('Y-m-d'),
        'amount_minor' => 7777,
        'description' => 'Post now test',
        'expense_gl_account_id' => $expenseGlId,
        'credit_gl_account_id' => $bankId,
        'category' => 'supplies',
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $expense = Expense::query()->latest('id')->first();
    $eid = (int) $expense->id;
    tenancy()->end();

    $this->post('http://'.$host.'/accounting/expenses/'.$eid.'/post-journal-now')->assertRedirect();

    tenancy()->initialize($tenant);
    $expense->refresh();
    $je = JournalEntry::query()->findOrFail((int) $expense->journal_entry_id);
    expect($je->status)->toBe(JournalEntry::STATUS_POSTED);
    tenancy()->end();
});

it('allows external_accountant to list expenses but not create', function (): void {
    Http::preventStrayRequests();

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Expense RO '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@expense-ro.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->slug.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'accounting')->update(['enabled' => true]);
    completeTenantWorkspaceOnboarding();

    $readonly = User::factory()->create([
        'email' => 'ro-'.uniqid().'@expense-ro.test',
        'name' => 'Accountant',
    ]);
    $readonly->syncRoles(['external_accountant']);
    tenancy()->end();

    $this->actingAs($readonly, 'web');

    $this->get('http://'.$host.'/accounting/expenses')->assertOk();
    $this->get('http://'.$host.'/accounting/expenses/create')->assertForbidden();
});
