<?php

declare(strict_types=1);

use App\Services\Accounting\AccountingJournalMetadataGuide;

it('exposes vendor metadata keys for each registered ledger', function (): void {
    $vendors = AccountingJournalMetadataGuide::vendorSpecificKeys();

    expect($vendors)->toHaveKeys(['zoho_books', 'xero', 'quickbooks', 'freeagent', 'sage']);
    expect($vendors['zoho_books']['header'])->toHaveKey('external_invoice_id');
});
