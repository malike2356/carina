<?php

declare(strict_types=1);

use App\Models\Tenant\Contact;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Http\UploadedFile;

beforeEach(function () {
    $this->seed(FeatureFlagSeeder::class);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('supports CRM CSV template import and export', function () {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'CRM IO '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@crm-io.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/api/crm/contacts/template')
        ->assertOk();

    $csv = "first_name,last_name,email,type,notes\nImport,A,import-a-".uniqid()."@t.test,buyer,Hello\n";

    $import = $this->post('http://'.$host.'/api/crm/contacts/import', [
        'file' => UploadedFile::fake()->createWithContent('contacts.csv', $csv),
        'duplicate_mode' => 'skip',
    ]);
    $import->assertOk()->assertJsonPath('created', 1);

    $export = $this->get('http://'.$host.'/api/crm/contacts/export');
    $export->assertOk();
    expect($export->streamedContent())->toContain('Import');

    $xlsx = $this->get('http://'.$host.'/api/crm/contacts/export?format=xlsx');
    $xlsx->assertOk();

    tenancy()->initialize($tenant);
    expect(Contact::query()->where('first_name', 'Import')->exists())->toBeTrue();
    tenancy()->end();
});
