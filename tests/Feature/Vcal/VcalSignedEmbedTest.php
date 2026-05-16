<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use App\Services\Vcal\VcalEmbedTokenService;
use Tests\Concerns\RefreshDatabase;

uses(RefreshDatabase::class);

it('renders embed page when signed URL is valid and rejects tampered signature', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'viCal Embed '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@vical-embed.test',
        'plan' => 'starter',
    ]);

    $hostDomain = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'booking_calendar')->update(['enabled' => true]);

    $user = User::query()->firstOrFail();
    $user->booking_public_slug = 'embed-host';
    $user->save();

    $signedUrl = app(VcalEmbedTokenService::class)->signedEmbedUrl('embed-host', ['height' => 600]);
    tenancy()->end();
    $ok = $this->get($signedUrl);
    $ok->assertOk();

    $bad = str_replace('signature=', 'signature=x', $signedUrl);
    $this->get($bad)->assertForbidden();
});
