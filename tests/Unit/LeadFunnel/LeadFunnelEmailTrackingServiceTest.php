<?php

declare(strict_types=1);

use App\Models\Tenant\Contact;
use App\Services\LeadFunnel\LeadFunnelEmailTrackingService;
use App\Services\LeadFunnel\LeadFunnelEngagementService;
use Illuminate\Support\Facades\Cache;

it('registers and resolves tracking tokens', function (): void {
    Cache::flush();

    $service = app(LeadFunnelEmailTrackingService::class);
    $token = $service->register('tenant-1', 42);

    expect($service->resolve($token))->toBe([
        'tenant_id' => 'tenant-1',
        'contact_id' => 42,
    ]);
});

it('instruments html with open pixel and wrapped links', function (): void {
    $service = app(LeadFunnelEmailTrackingService::class);
    $html = $service->instrumentHtml('<a href="https://example.test/page">Go</a>', 'token-123');

    expect($html)
        ->toContain('lead-funnel/track/open/token-123')
        ->toContain('lead-funnel/track/click/token-123');
});

it('identifies marketing intake people by stage or source', function (): void {
    $service = app(LeadFunnelEngagementService::class);

    $staged = new Contact(['lead_funnel_stage_id' => 1, 'source' => 'manual']);
    $sourced = new Contact(['source' => 'facebook']);

    expect($service->isLeadFunnelContact($staged))->toBeTrue()
        ->and($service->isLeadFunnelContact($sourced))->toBeTrue()
        ->and($service->isLeadFunnelContact(new Contact(['source' => 'manual'])))->toBeFalse();
});
