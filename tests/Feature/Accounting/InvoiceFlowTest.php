<?php

declare(strict_types=1);

use App\Mail\Accounting\InvoiceMail;
use App\Models\Central\FeatureFlag;
use App\Models\Tenant\Invoice;
use App\Models\Tenant\JournalEntry;
use App\Models\Tenant\Receipt;
use App\Models\Tenant\User;
use App\Services\Accounting\InvoiceService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Mail;

it('creates a draft invoice with line items and computes totals correctly', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Invoice Totals '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@invoice-totals.test',
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

    tenancy()->initialize($tenant);
    $invSvc = app(InvoiceService::class);
    $invoice = $invSvc->create([
        'client_name' => 'Test Client',
        'client_email' => 'client@example.test',
        'client_address' => null,
        'contact_id' => null,
        'pipeline_deal_id' => null,
        'property_id' => null,
        'issue_date' => now()->toDateString(),
        'due_date' => now()->addDays(7)->toDateString(),
        'notes' => null,
        'terms' => 'Net 7',
        'currency' => 'GBP',
    ], [
        ['description' => 'Line A', 'quantity' => 2, 'unit_price_minor' => 1000, 'tax_rate_pct' => 20],
        ['description' => 'Line B', 'quantity' => 1, 'unit_price_minor' => 500, 'tax_rate_pct' => null],
    ], (int) $user->id);
    tenancy()->end();

    expect($invoice->subtotal_minor)->toBe(2500);
    expect($invoice->tax_minor)->toBe(400);
    expect($invoice->total_minor)->toBe(2900);
    expect($invoice->status)->toBe(Invoice::STATUS_DRAFT);

    $this->actingAs($user, 'web');
    $this->get('http://'.$host.'/accounting/invoices')->assertOk()->assertSee('Invoices');
});

it('transitions draft to sent, assigns invoice number, and sends email with PDF attachment', function (): void {
    Mail::fake();

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Invoice Send '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@invoice-send.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'accounting')->update(['enabled' => true]);
    completeTenantWorkspaceOnboarding();
    $user = User::query()->firstOrFail();

    $invSvc = app(InvoiceService::class);
    $invoice = $invSvc->create([
        'client_name' => 'Paying Client',
        'client_email' => 'payer@example.test',
        'client_address' => null,
        'contact_id' => null,
        'pipeline_deal_id' => null,
        'property_id' => null,
        'issue_date' => now()->toDateString(),
        'due_date' => now()->addDays(7)->toDateString(),
        'notes' => null,
        'terms' => 'Due on receipt',
        'currency' => 'GBP',
    ], [
        ['description' => 'Fee', 'quantity' => 1, 'unit_price_minor' => 10000, 'tax_rate_pct' => null],
    ], (int) $user->id);

    $invSvc->send($invoice->fresh());
    $invoice->refresh();

    tenancy()->end();

    expect($invoice->status)->toBe(Invoice::STATUS_SENT);
    expect($invoice->invoice_number)->toStartWith('INV-');
    Mail::assertQueued(InvoiceMail::class);
});

it('marks an invoice as fully paid and creates a receipt', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Invoice Paid '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@invoice-paid.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'accounting')->update(['enabled' => true]);
    completeTenantWorkspaceOnboarding();
    $user = User::query()->firstOrFail();

    $invSvc = app(InvoiceService::class);
    $invoice = $invSvc->create([
        'client_name' => 'Client',
        'client_email' => null,
        'client_address' => null,
        'contact_id' => null,
        'pipeline_deal_id' => null,
        'property_id' => null,
        'issue_date' => now()->toDateString(),
        'due_date' => now()->addDays(7)->toDateString(),
        'notes' => null,
        'terms' => null,
        'currency' => 'GBP',
    ], [
        ['description' => 'Fee', 'quantity' => 1, 'unit_price_minor' => 5000, 'tax_rate_pct' => null],
    ], (int) $user->id);
    $invSvc->send($invoice->fresh());

    $receipt = $invSvc->markPaid($invoice->fresh(), 5000, 'bank_transfer', 'REF-1', (int) $user->id, false);
    $invoice->refresh();

    tenancy()->end();

    expect($receipt)->toBeInstanceOf(Receipt::class);
    expect($receipt->receipt_number)->toStartWith('RCP-');
    expect($invoice->status)->toBe(Invoice::STATUS_PAID);
    expect($invoice->amount_paid_minor)->toBe(5000);
});

it('marks a partial payment and status becomes partially_paid', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Invoice Partial '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@invoice-partial.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'accounting')->update(['enabled' => true]);
    completeTenantWorkspaceOnboarding();
    $user = User::query()->firstOrFail();

    $invSvc = app(InvoiceService::class);
    $invoice = $invSvc->create([
        'client_name' => 'Client',
        'client_email' => null,
        'client_address' => null,
        'contact_id' => null,
        'pipeline_deal_id' => null,
        'property_id' => null,
        'issue_date' => now()->toDateString(),
        'due_date' => now()->addDays(7)->toDateString(),
        'notes' => null,
        'terms' => null,
        'currency' => 'GBP',
    ], [
        ['description' => 'Fee', 'quantity' => 1, 'unit_price_minor' => 10000, 'tax_rate_pct' => null],
    ], (int) $user->id);
    $invSvc->send($invoice->fresh());
    $invSvc->markPaid($invoice->fresh(), 4000, 'card', null, (int) $user->id, false);
    $invoice->refresh();

    tenancy()->end();

    expect($invoice->status)->toBe(Invoice::STATUS_PARTIALLY_PAID);
    expect($invoice->amount_paid_minor)->toBe(4000);
});

it('voids an invoice that is in sent status', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Invoice Void '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@invoice-void.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'accounting')->update(['enabled' => true]);
    completeTenantWorkspaceOnboarding();
    $user = User::query()->firstOrFail();

    $invSvc = app(InvoiceService::class);
    $invoice = $invSvc->create([
        'client_name' => 'Client',
        'client_email' => null,
        'client_address' => null,
        'contact_id' => null,
        'pipeline_deal_id' => null,
        'property_id' => null,
        'issue_date' => now()->toDateString(),
        'due_date' => now()->addDays(7)->toDateString(),
        'notes' => null,
        'terms' => null,
        'currency' => 'GBP',
    ], [
        ['description' => 'Fee', 'quantity' => 1, 'unit_price_minor' => 1000, 'tax_rate_pct' => null],
    ], (int) $user->id);
    $invSvc->send($invoice->fresh());
    $invSvc->void($invoice->fresh());

    tenancy()->end();

    expect($invoice->fresh()->status)->toBe(Invoice::STATUS_VOID);
});

it('prevents editing a sent invoice', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Invoice Edit Block '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@invoice-edit.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->slug.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'accounting')->update(['enabled' => true]);
    completeTenantWorkspaceOnboarding();
    $user = User::query()->firstOrFail();

    $invSvc = app(InvoiceService::class);
    $invoice = $invSvc->create([
        'client_name' => 'Client',
        'client_email' => null,
        'client_address' => null,
        'contact_id' => null,
        'pipeline_deal_id' => null,
        'property_id' => null,
        'issue_date' => now()->toDateString(),
        'due_date' => now()->addDays(7)->toDateString(),
        'notes' => null,
        'terms' => null,
        'currency' => 'GBP',
    ], [
        ['description' => 'Fee', 'quantity' => 1, 'unit_price_minor' => 1000, 'tax_rate_pct' => null],
    ], (int) $user->id);
    $invSvc->send($invoice->fresh());
    $id = (int) $invoice->id;
    tenancy()->end();

    $this->actingAs($user, 'web');
    $this->get('http://'.$host.'/accounting/invoices/'.$id.'/edit')->assertForbidden();
});

it('auto-numbers sequentially within the same year', function (): void {
    Mail::fake();

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Invoice Seq '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@invoice-seq.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'accounting')->update(['enabled' => true]);
    completeTenantWorkspaceOnboarding();
    $user = User::query()->firstOrFail();

    $invSvc = app(InvoiceService::class);
    $mk = fn () => $invSvc->create([
        'client_name' => 'Client',
        'client_email' => 'a@b.c',
        'client_address' => null,
        'contact_id' => null,
        'pipeline_deal_id' => null,
        'property_id' => null,
        'issue_date' => now()->toDateString(),
        'due_date' => now()->addDays(7)->toDateString(),
        'notes' => null,
        'terms' => null,
        'currency' => 'GBP',
    ], [
        ['description' => 'Fee', 'quantity' => 1, 'unit_price_minor' => 100, 'tax_rate_pct' => null],
    ], (int) $user->id);

    $a = $mk();
    $invSvc->send($a->fresh());
    $b = $mk();
    $invSvc->send($b->fresh());

    $y = now()->year;
    tenancy()->end();

    expect($a->fresh()->invoice_number)->toBe(sprintf('INV-%d-%06d', $y, 1));
    expect($b->fresh()->invoice_number)->toBe(sprintf('INV-%d-%06d', $y, 2));
});

it('marks overdue invoices via console command', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Invoice Overdue '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@invoice-overdue.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'accounting')->update(['enabled' => true]);
    completeTenantWorkspaceOnboarding();
    $user = User::query()->firstOrFail();

    $invSvc = app(InvoiceService::class);
    $invoice = $invSvc->create([
        'client_name' => 'Client',
        'client_email' => null,
        'client_address' => null,
        'contact_id' => null,
        'pipeline_deal_id' => null,
        'property_id' => null,
        'issue_date' => now()->subDays(20)->toDateString(),
        'due_date' => now()->subDays(5)->toDateString(),
        'notes' => null,
        'terms' => null,
        'currency' => 'GBP',
    ], [
        ['description' => 'Fee', 'quantity' => 1, 'unit_price_minor' => 1000, 'tax_rate_pct' => null],
    ], (int) $user->id);
    $invSvc->send($invoice->fresh());
    tenancy()->end();

    Artisan::call('invoices:mark-overdue');

    tenancy()->initialize($tenant);
    expect($invoice->fresh()->status)->toBe(Invoice::STATUS_OVERDUE);
    tenancy()->end();
});

it('downloads a PDF with 200 status and correct content-type', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Invoice PDF '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@invoice-pdf.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->slug.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'accounting')->update(['enabled' => true]);
    completeTenantWorkspaceOnboarding();
    $user = User::query()->firstOrFail();

    $invSvc = app(InvoiceService::class);
    $invoice = $invSvc->create([
        'client_name' => 'Client',
        'client_email' => null,
        'client_address' => null,
        'contact_id' => null,
        'pipeline_deal_id' => null,
        'property_id' => null,
        'issue_date' => now()->toDateString(),
        'due_date' => now()->addDays(7)->toDateString(),
        'notes' => null,
        'terms' => null,
        'currency' => 'GBP',
    ], [
        ['description' => 'Fee', 'quantity' => 1, 'unit_price_minor' => 1000, 'tax_rate_pct' => null],
    ], (int) $user->id);
    $id = (int) $invoice->id;
    tenancy()->end();

    $this->actingAs($user, 'web');
    $res = $this->get('http://'.$host.'/accounting/invoices/'.$id.'/pdf');
    $res->assertOk();
    expect(strtolower($res->headers->get('content-type')))->toContain('pdf');
    expect(substr($res->getContent(), 0, 4))->toBe('%PDF');
});

it('posts draft journal when mark paid with post to journal flag', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Invoice JE '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@invoice-je.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'accounting')->update(['enabled' => true]);
    completeTenantWorkspaceOnboarding();
    $user = User::query()->firstOrFail();

    $invSvc = app(InvoiceService::class);
    $invoice = $invSvc->create([
        'client_name' => 'Client',
        'client_email' => null,
        'client_address' => null,
        'contact_id' => null,
        'pipeline_deal_id' => null,
        'property_id' => null,
        'issue_date' => now()->toDateString(),
        'due_date' => now()->addDays(7)->toDateString(),
        'notes' => null,
        'terms' => null,
        'currency' => 'GBP',
    ], [
        ['description' => 'Fee', 'quantity' => 1, 'unit_price_minor' => 2000, 'tax_rate_pct' => null],
    ], (int) $user->id);
    $invSvc->send($invoice->fresh());
    $invSvc->markPaid($invoice->fresh(), 2000, 'bank_transfer', null, (int) $user->id, true);

    $count = JournalEntry::query()->count();
    tenancy()->end();

    expect($count)->toBeGreaterThan(0);
});
