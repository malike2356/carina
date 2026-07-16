<?php

declare(strict_types=1);

use App\Models\Central\LegalDocument;
use App\Models\Central\PlatformUser;
use App\Models\Tenant\TenantLegalDocument;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\ThemePresetSeeder;

const LEGAL_PLACEHOLDER_HTML = '<p>This document is being finalised by our legal team. Please check back soon for the full text. If you have urgent questions, contact support.</p>';

it('returns legal index with published documents', function (): void {
    LegalDocument::on('central')->create([
        'slug' => 'privacy_policy',
        'title' => 'Privacy Policy',
        'content_html' => LEGAL_PLACEHOLDER_HTML,
        'version' => '1.0',
        'published' => true,
        'published_at' => now(),
    ]);

    $this->get('http://propreneur.test/legal')
        ->assertOk()
        ->assertSee('Privacy Policy');
});

it('shows a published legal document by slug', function (): void {
    LegalDocument::on('central')->create([
        'slug' => 'privacy_policy',
        'title' => 'Privacy Policy',
        'content_html' => LEGAL_PLACEHOLDER_HTML,
        'version' => '1.0',
        'published' => true,
        'published_at' => now(),
    ]);

    $this->get('http://propreneur.test/legal/privacy_policy')
        ->assertOk()
        ->assertSee('Privacy Policy', false);
});

it('returns not found for unpublished legal documents', function (): void {
    LegalDocument::on('central')->create([
        'slug' => 'privacy_policy',
        'title' => 'Privacy Policy',
        'content_html' => LEGAL_PLACEHOLDER_HTML,
        'version' => '1.0',
        'published' => false,
    ]);

    $this->get('http://propreneur.test/legal/privacy_policy')->assertNotFound();
});

it('redirects privacy short url to privacy policy', function (): void {
    $this->get('http://propreneur.test/privacy')
        ->assertRedirect('/legal/privacy_policy');
});

it('redirects terms short url to terms of service', function (): void {
    $this->get('http://propreneur.test/terms')
        ->assertRedirect('/legal/terms_of_service');
});

it('allows platform admin to create and publish a legal document', function (): void {
    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->post(route('admin.legal.store'), [
            'slug' => 'custom_policy',
            'title' => 'Custom Policy',
            'content_html' => LEGAL_PLACEHOLDER_HTML,
            'version' => '1.0',
        ])
        ->assertRedirect(route('admin.legal.index'));

    $document = LegalDocument::on('central')->where('slug', 'custom_policy')->first();
    expect($document)->not->toBeNull()
        ->and($document->published)->toBeFalse();

    $this->actingAs($admin, 'platform')
        ->post(route('admin.legal.publish', $document))
        ->assertRedirect(route('admin.legal.index'));

    expect($document->fresh()->published)->toBeTrue();
});

it('allows platform admin to update a document and increment version', function (): void {
    $admin = PlatformUser::factory()->superAdmin()->create();

    $document = LegalDocument::on('central')->create([
        'slug' => 'privacy_policy',
        'title' => 'Privacy Policy',
        'content_html' => LEGAL_PLACEHOLDER_HTML,
        'version' => '1.0',
        'published' => true,
        'published_at' => now(),
    ]);

    $this->actingAs($admin, 'platform')
        ->put(route('admin.legal.update', $document), [
            'slug' => 'privacy_policy',
            'title' => 'Privacy Policy',
            'content_html' => LEGAL_PLACEHOLDER_HTML.'<p>Updated clause.</p>',
            'version' => '1.1',
        ])
        ->assertRedirect(route('admin.legal.index'));

    expect($document->fresh()->version)->toBe('1.1');
});

it('allows tenant admin to create and publish a tenant legal document', function (): void {
    $this->seed(ThemePresetSeeder::class);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Legal Tenant '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@legal-tenant.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->firstOrFail()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->withServerVariables(['HTTP_HOST' => $host])
        ->post('http://'.$host.'/settings/legal', [
            'slug' => 'workspace_privacy_policy',
            'title' => 'Workspace Privacy Policy',
            'content_html' => LEGAL_PLACEHOLDER_HTML,
            'version' => '1.0',
        ])
        ->assertRedirect('/settings/legal');

    tenancy()->initialize($tenant);
    $document = TenantLegalDocument::query()->where('slug', 'workspace_privacy_policy')->first();
    expect($document)->not->toBeNull();
    tenancy()->end();

    $this->withServerVariables(['HTTP_HOST' => $host])
        ->post(route('tenant.settings.legal.publish', $document))
        ->assertRedirect('/settings/legal');

    tenancy()->initialize($tenant);
    expect($document->fresh()->published)->toBeTrue();
    tenancy()->end();
});

it('lists published tenant legal documents on tenant legal index', function (): void {
    $this->seed(ThemePresetSeeder::class);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Legal Public '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@legal-public.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->firstOrFail()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    TenantLegalDocument::query()->create([
        'slug' => 'workspace_privacy_policy',
        'title' => 'Workspace Privacy Policy',
        'content_html' => LEGAL_PLACEHOLDER_HTML,
        'version' => '1.0',
        'published' => true,
        'published_at' => now(),
    ]);
    tenancy()->end();

    $this->withServerVariables(['HTTP_HOST' => $host])
        ->get('http://'.$host.'/legal')
        ->assertOk()
        ->assertSee('Workspace Privacy Policy');
});
