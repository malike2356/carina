<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('returns widget bootstrap json and creates floating_widget conversation', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Carina Widget '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@carina-widget.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $res = $this->getJson('http://'.$host.'/carina/widget/bootstrap');
    $res->assertOk()
        ->assertJsonStructure([
            'conversation_id',
            'title',
            'messages',
            'message_url',
            'preferences_url',
            'speech_transcribe_url',
            'full_page_url',
            'brain_options',
            'default_brain',
            'default_mode',
            'incognito',
        ]);

    tenancy()->initialize($tenant);
    $conv = CarinaConversation::query()->where('user_id', $user->id)->where('context_type', 'floating_widget')->first();
    expect($conv)->not->toBeNull()
        ->and((int) $conv->context_id)->toBe(0);
    tenancy()->end();
});
