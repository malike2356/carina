<?php

declare(strict_types=1);

use App\Services\Audit\AuditExportService;
use App\Services\Audit\AuditRetentionService;

it('resolves audit export and retention services', function (): void {
    expect(app(AuditExportService::class))->toBeInstanceOf(AuditExportService::class);
    expect(app(AuditRetentionService::class))->toBeInstanceOf(AuditRetentionService::class);
});
