<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\Property;
use App\Models\Tenant\PropertyTenancy;
use App\Models\Tenant\TenancyDocument;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use App\Support\Tenancy\TenantWorkspaceUrl;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
    $this->seed(FeatureFlagSeeder::class);
});

it('portal session scoped to one tenancy cannot read another tenancy documents', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Portal ACL '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'portal-'.uniqid().'@test.test',
        'plan' => 'starter',
        'send_welcome_email' => false,
    ]);

    $host = $tenant->domains->first()->domain.'.'.config('tenancy.tenant_base_domain');

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    $user = User::query()->where('email', $tenant->owner_email)->firstOrFail();
    $property = Property::query()->create([
        'address_line1' => '10 Portal Way',
        'city' => 'Leeds',
        'postcode' => 'LS3 3CC',
        'property_type' => 'hmo',
        'strategy' => 'hmo',
        'status' => 'managing',
        'created_by' => $user->id,
    ]);
    $tenancyA = PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'Tenant A',
        'email' => 'tenanta@portal.test',
        'rent_amount' => 500,
        'start_date' => now()->subMonth(),
    ]);
    $tenancyB = PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'Tenant B',
        'email' => 'tenantb@portal.test',
        'rent_amount' => 600,
        'start_date' => now()->subMonth(),
    ]);
    $docB = TenancyDocument::query()->create([
        'property_tenancy_id' => $tenancyB->id,
        'category' => TenancyDocument::CATEGORY_AST,
        'name' => 'Tenant B AST.pdf',
        'path' => 'tenancies/'.$tenancyB->id.'/documents/fake.pdf',
        'uploaded_by' => $user->id,
    ]);

    $acceptUrl = TenantWorkspaceUrl::temporarySignedRoute(
        $tenant,
        'tenant.portal.accept',
        now()->addHour(),
        ['tenancy' => $tenancyA->id],
    );

    $verifyUrl = TenantWorkspaceUrl::temporarySignedRoute(
        $tenant,
        'tenant.portal.verify',
        now()->addHour(),
        ['tenancy' => $tenancyA->id],
    );

    tenancy()->end();

    $acceptPath = signedTenantPathFromUrl($acceptUrl);
    $verifyPath = signedTenantPathFromUrl($verifyUrl);

    tenantGet($host, $acceptPath)->assertOk();

    test()->withServerVariables(['HTTP_HOST' => $host])
        ->post(tenantHttpUrl($host, $verifyPath), ['email' => 'tenanta@portal.test'])
        ->assertRedirect(tenantHttpUrl($host, '/tenant-portal/home'));

    tenantGet($host, '/tenant-portal/documents/'.$docB->id.'/download')
        ->assertForbidden();
});

it('rejects expired portal invite link', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Portal Exp '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'portal-exp-'.uniqid().'@test.test',
        'plan' => 'starter',
        'send_welcome_email' => false,
    ]);

    $host = $tenant->domains->first()->domain.'.'.config('tenancy.tenant_base_domain');

    tenancy()->initialize($tenant);
    $user = User::query()->where('email', $tenant->owner_email)->firstOrFail();
    $property = Property::query()->create([
        'address_line1' => '2 Expired Close',
        'city' => 'Leeds',
        'postcode' => 'LS4 4DD',
        'property_type' => 'btl',
        'status' => 'managing',
        'created_by' => $user->id,
    ]);
    $tenancy = PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'Expired Tenant',
        'email' => 'expired@portal.test',
        'rent_amount' => 700,
        'start_date' => now()->subYear(),
    ]);

    $expiredUrl = TenantWorkspaceUrl::temporarySignedRoute(
        $tenant,
        'tenant.portal.accept',
        now()->subMinute(),
        ['tenancy' => $tenancy->id],
    );

    tenancy()->end();

    tenantGet($host, signedTenantPathFromUrl($expiredUrl))->assertForbidden();
});

function signedTenantPathFromUrl(string $url): string
{
    $path = parse_url($url, PHP_URL_PATH) ?? '/';
    $query = parse_url($url, PHP_URL_QUERY);

    return is_string($query) && $query !== '' ? $path.'?'.$query : $path;
}
