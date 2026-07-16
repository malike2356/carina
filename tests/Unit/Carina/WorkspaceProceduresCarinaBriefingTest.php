<?php

declare(strict_types=1);

use App\Services\Carina\WorkspaceProceduresCarinaBriefing;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('returns empty tenant appendix when tenancy is not initialized', function (): void {
    expect(app(WorkspaceProceduresCarinaBriefing::class)->forTenantWorkspace())->toBe('');
});

it('includes tenant operational embedding when tenancy is active', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Proc Brief '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@proc-brief.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $text = app(WorkspaceProceduresCarinaBriefing::class)->forTenantWorkspace();
    tenancy()->end();

    expect($text)->toContain('Operational embedding (tenant workspace');
});

it('includes platform operator operational embedding', function (): void {
    $text = app(WorkspaceProceduresCarinaBriefing::class)->forPlatformConsole();

    expect($text)->toContain('Operational embedding (platform console');
});
