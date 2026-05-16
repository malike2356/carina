<?php

declare(strict_types=1);

it('registers accounting integrations catalog API route', function (): void {
    $registered = collect(app('router')->getRoutes())
        ->map(fn ($r) => $r->getName())
        ->filter()
        ->values();

    expect($registered)->toContain('tenant.api.accounting.integrations.catalog')
        ->and($registered)->toContain('tenant.api.accounting.integrations.sync.pull')
        ->and($registered)->toContain('tenant.api.accounting.integrations.sync.push');
});
