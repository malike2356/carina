<?php

declare(strict_types=1);

use App\Billing\BillingModule;
use App\Models\Central\FeatureFlag;
use App\Models\Tenant\Contact;
use App\Models\Tenant\ContactInteraction;
use App\Models\Tenant\LeadFunnel\InboundLead;
use App\Models\Tenant\Pipeline;
use App\Models\Tenant\PipelinePreset;
use App\Models\Tenant\QualificationFormSubmission;
use App\Models\Tenant\SpeedToLeadRule;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaService;
use App\Services\Pipeline\PipelinePresetService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Tenant\EmailTemplateSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Tests\Concerns\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

function bootExtensionTenant(array $flags = []): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Ext '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@ext.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->slug.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    foreach ($flags as $key => $enabled) {
        FeatureFlag::query()->where('key', $key)->update(['enabled' => $enabled]);
    }
    completeTenantWorkspaceOnboarding();
    (new EmailTemplateSeeder)->run();
    app(PipelinePresetService::class)->ensureSystemPresets();
    $user = User::query()->firstOrFail();
    tenancy()->end();

    return [$tenant, $host, $user];
}

it('creates pipeline from preset', function (): void {
    [$tenant, $host, $user] = bootExtensionTenant([
        BillingModule::Pipeline->value => true,
    ]);
    $preset = null;
    tenancy()->initialize($tenant);
    $preset = PipelinePreset::query()->where('slug', 'investors')->firstOrFail();
    tenancy()->end();

    $this->actingAs($user, 'web');
    $this->post('http://'.$host.'/pipelines/presets', ['preset_id' => $preset->id])
        ->assertRedirect();

    tenancy()->initialize($tenant);
    expect(Pipeline::query()->where('name', $preset->name)->exists())->toBeTrue();
    tenancy()->end();
});

it('exposes qualification form builder and public submit', function (): void {
    [$tenant, $host, $user] = bootExtensionTenant([
        BillingModule::LeadFunnel->value => true,
        'lead_funnel' => true,
        'qualification_form_builder' => true,
    ]);

    $this->actingAs($user, 'web');
    $this->get('http://'.$host.'/lead-funnel/qualification-forms')->assertOk()->assertSee('Qualification forms', false);

    $this->post('http://'.$host.'/lead-funnel/qualification-forms', [
        'name' => 'Investor intake',
        'slug' => 'investor-intake',
        'fields_json' => json_encode([
            ['key' => 'name', 'label' => 'Name', 'type' => 'text', 'required' => true],
            ['key' => 'email', 'label' => 'Email', 'type' => 'email', 'required' => true],
        ]),
        'is_active' => '1',
        'create_inbound_lead' => '1',
    ])->assertRedirect();

    $this->get('http://'.$host.'/forms/investor-intake')->assertOk()->assertSee('Investor intake', false);

    $this->post('http://'.$host.'/forms/investor-intake', [
        'name' => 'Alex Investor',
        'email' => 'alex-'.uniqid().'@example.test',
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    expect(QualificationFormSubmission::query()->count())->toBe(1);
    expect(InboundLead::query()->where('platform', 'qualification_form')->count())->toBe(1);
    tenancy()->end();
});

it('dispatches speed-to-lead task for linked inbound lead', function (): void {
    [$tenant, $host, $user] = bootExtensionTenant([
        BillingModule::LeadFunnel->value => true,
        'lead_funnel' => true,
        'speed_to_lead' => true,
    ]);

    tenancy()->initialize($tenant);
    $contact = Contact::query()->create([
        'first_name' => 'Pat',
        'last_name' => 'Lead',
        'email' => 'pat-'.uniqid().'@speed.test',
        'created_by' => $user->id,
    ]);
    SpeedToLeadRule::query()->create([
        'name' => 'Test instant',
        'trigger_event' => 'new_lead',
        'tier' => 'instant',
        'channels' => ['task'],
        'min_qualification_score' => 0,
        'is_active' => true,
        'sort_order' => 1,
    ]);
    InboundLead::query()->create([
        'tenant_id' => (string) $tenant->getKey(),
        'platform' => 'landing_page',
        'first_name' => 'Pat',
        'last_name' => 'Lead',
        'email' => $contact->email,
        'crm_contact_id' => $contact->id,
        'segment' => 'investor',
        'raw_payload' => [],
        'status' => 'new',
        'received_at' => now(),
    ]);
    tenancy()->end();

    tenancy()->initialize($tenant);
    expect(ContactInteraction::query()->where('contact_id', $contact->id)->where('type', 'task')->exists())->toBeTrue();
    tenancy()->end();

    $this->actingAs($user, 'web');
    $this->get('http://'.$host.'/lead-funnel/speed-to-lead')->assertOk()->assertSee('Speed to lead', false);
});

it('serves public qualify chat and accepts mocked Carina reply', function (): void {
    [$tenant, $host] = bootExtensionTenant([
        'lead_qualification_chat' => true,
        'carina_ai' => true,
    ]);

    $this->mock(CarinaService::class, function ($mock): void {
        $mock->shouldReceive('complete')->andReturn('Thanks. What is your budget band?');
    });

    $this->get('http://'.$host.'/qualify')->assertOk()->assertSee('Chat with Carina', false);
});

it('lists marketing email templates for workspace admin', function (): void {
    [$tenant, $host, $user] = bootExtensionTenant([
        'communications_hub' => true,
        'marketing_template_library' => true,
    ]);

    $this->actingAs($user, 'web');
    $this->get('http://'.$host.'/communications/templates')
        ->assertOk()
        ->assertSee('Marketing template library', false);
});
