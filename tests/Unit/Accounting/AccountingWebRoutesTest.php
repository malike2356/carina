<?php

declare(strict_types=1);

it('registers tenant accounting integrations web routes', function (): void {
    $registered = collect(app('router')->getRoutes())
        ->map(fn ($r) => $r->getName())
        ->filter()
        ->values();

    expect($registered)->toContain('tenant.accounting.integrations.index')
        ->and($registered)->toContain('tenant.accounting.integrations.connect')
        ->and($registered)->toContain('tenant.accounting.integrations.callback');
});
