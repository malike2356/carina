<?php

declare(strict_types=1);

use App\Mail\Accounting\ReceiptMail;
use App\Models\Central\FeatureFlag;
use App\Models\Tenant\Invoice;
use App\Models\Tenant\Receipt;
use App\Models\Tenant\User;
use App\Services\Accounting\InvoiceService;
use App\Services\Accounting\ReceiptService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Facades\Mail;

it('creates a standalone receipt not linked to an invoice', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Receipt Standalone '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@rcpt-sa.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'accounting')->update(['enabled' => true]);
    completeTenantWorkspaceOnboarding();
    $user = User::query()->firstOrFail();

    $rcptSvc = app(ReceiptService::class);
    $receipt = $rcptSvc->create([
        'client_name' => 'Payer',
        'client_email' => 'payer@example.test',
        'payment_date' => now()->toDateString(),
        'amount_minor' => 7500,
        'payment_method' => 'cash',
        'reference' => null,
        'notes' => 'Thanks',
        'invoice_id' => null,
    ], (int) $user->id);

    tenancy()->end();

    expect($receipt->invoice_id)->toBeNull();
    expect($receipt->receipt_number)->toStartWith('RCP-');
});

it('sends a receipt email with PDF attachment', function (): void {
    Mail::fake();

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Receipt Mail '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@rcpt-mail.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'accounting')->update(['enabled' => true]);
    completeTenantWorkspaceOnboarding();
    $user = User::query()->firstOrFail();

    $rcptSvc = app(ReceiptService::class);
    $receipt = $rcptSvc->create([
        'client_name' => 'Payer',
        'client_email' => 'payer2@example.test',
        'payment_date' => now()->toDateString(),
        'amount_minor' => 1000,
        'payment_method' => 'bank_transfer',
        'reference' => 'X',
        'notes' => null,
        'invoice_id' => null,
    ], (int) $user->id);

    $rcptSvc->send($receipt->fresh());

    tenancy()->end();

    Mail::assertQueued(ReceiptMail::class);
});

it('creates a receipt via mark-paid and links it to the invoice', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Receipt Linked '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@rcpt-link.test',
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
        ['description' => 'Fee', 'quantity' => 1, 'unit_price_minor' => 3000, 'tax_rate_pct' => null],
    ], (int) $user->id);
    $invSvc->send($invoice->fresh());

    $receipt = $invSvc->markPaid($invoice->fresh(), 3000, 'card', 'AUTH', (int) $user->id, false);

    tenancy()->end();

    expect((int) $receipt->invoice_id)->toBe((int) $invoice->id);
    expect(Receipt::query()->where('invoice_id', $invoice->id)->count())->toBe(1);
    expect($invoice->fresh()->status)->toBe(Invoice::STATUS_PAID);
});
