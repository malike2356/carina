<?php

declare(strict_types=1);

use App\Models\Central\AiProvider;
use App\Models\Central\FeatureFlag;
use App\Models\Tenant\StructureAdviceSession;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Facades\Http;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    $this->withoutMiddleware(VerifyCsrfToken::class);

    Http::preventStrayRequests();
    $groq = AiProvider::query()->where('slug', 'groq')->firstOrFail();
    $groq->update([
        'api_key' => 'gsk-test-key',
        'api_base_url' => 'https://api.carina-test.invalid/openai/v1',
        'is_enabled' => true,
    ]);
    Http::fake([
        'https://api.carina-test.invalid/openai/v1/chat/completions' => Http::response([
            'choices' => [['message' => ['content' => 'Based on your answers, a limited company may be worth exploring with your accountant.']]],
            'usage' => ['prompt_tokens' => 10, 'completion_tokens' => 20],
        ], 200),
    ]);

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Structure Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@structure.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';
    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');
    $this->baseUrl = 'http://'.$host;
    $this->tenant = $tenant;
    $this->user = $user;
});

afterEach(function (): void {
    Http::allowStrayRequests();
});

it('structure advisor index page returns 200', function (): void {
    $this->get($this->baseUrl.'/tools/structure-advisor')->assertOk();
});

it('stores a session via HTTP endpoint', function (): void {
    $response = $this->postJson($this->baseUrl.'/tools/structure-advisor/score', [
        'tax_bracket' => 'higher',
        'investment_horizon_years' => 10,
        'target_property_count' => 5,
        'strategies' => ['investment'],
        'generational_intent' => false,
        'non_resident_intent' => false,
        'income_extraction_urgency' => 'medium',
        'existing_companies' => 0,
    ]);

    $response->assertOk()
        ->assertJsonStructure(['recommendation', 'label', 'score', 'narrative', 'next_steps', 'session_id']);

    tenancy()->initialize($this->tenant);
    expect(StructureAdviceSession::query()->count())->toBe(1);
    tenancy()->end();
});

it('forbids viewing another users session', function (): void {
    tenancy()->initialize($this->tenant);
    $session = StructureAdviceSession::query()->create([
        'user_id' => $this->user->id,
        'answers' => [],
        'recommendation' => 'personal',
        'recommendation_detail' => ['narrative' => 'Test'],
        'completed_at' => now(),
    ]);

    $other = User::factory()->create([
        'email' => 'staff-'.uniqid().'@structure.test',
    ]);
    tenancy()->end();

    $this->actingAs($other, 'web')
        ->get($this->baseUrl.'/tools/structure-advisor/'.$session->id)
        ->assertForbidden();
});
