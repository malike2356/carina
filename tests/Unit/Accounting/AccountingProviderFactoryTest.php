<?php

declare(strict_types=1);

use App\Services\Accounting\Contracts\AccountingProviderFactory;

it('registers all first-class UK external ledger provider keys', function (): void {
    $keys = app(AccountingProviderFactory::class)->registeredKeys();

    expect($keys)->toContain('zoho_books')
        ->and($keys)->toContain('xero')
        ->and($keys)->toContain('sage')
        ->and($keys)->toContain('freeagent')
        ->and($keys)->toContain('quickbooks');
});
