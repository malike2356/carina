<?php

declare(strict_types=1);

use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;

it('uses host-only session cookies after tenancy is initialized', function (): void {
    Http::preventStrayRequests();

    Config::set('session.domain', '.propreneur.uk');

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Session scope '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@session-scope.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    expect(config('session.domain'))->toBeNull();

    tenancy()->end();
});
