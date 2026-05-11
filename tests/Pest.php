<?php

use App\Models\Central\AiProvider;
use App\Models\Central\Tenant;
use App\Models\Tenant\TenantSetting;
use App\Models\Tenant\User;
use App\Services\Onboarding\WorkspaceOnboardingService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\Concerns\RefreshDatabase;
use Tests\TestCase;

/*
|--------------------------------------------------------------------------
| Test case
|--------------------------------------------------------------------------
*/

pest()->extend(TestCase::class)->in('Feature', 'Unit', 'MigrationIntegration');

uses(RefreshDatabase::class)->in('Feature', 'MigrationIntegration');

/*
|--------------------------------------------------------------------------
| Expectations
|--------------------------------------------------------------------------
*/

expect()->extend('toBeOne', function () {
    return $this->toBe(1);
});

/*
|--------------------------------------------------------------------------
| Test helpers
|--------------------------------------------------------------------------
*/

function completeTenantWorkspaceOnboarding(): void
{
    $state = app(WorkspaceOnboardingService::class)->getState();
    $state['completed_at'] = now()->toIso8601String();
    $state['max_unlocked_step'] = WorkspaceOnboardingService::TOTAL_STEPS;

    TenantSetting::query()->updateOrCreate(
        ['key' => WorkspaceOnboardingService::SETTINGS_KEY],
        ['value' => json_encode($state), 'group' => 'onboarding']
    );
}

/**
 * @param  array<string, mixed>  $overrides
 */
function createCentralTenant(array $overrides = []): Tenant
{
    $slug = $overrides['slug'] ?? ('t-'.Str::lower(Str::random(8)));

    return Tenant::withoutEvents(fn () => Tenant::query()->create(array_merge([
        'id' => (string) Str::uuid(),
        'slug' => $slug,
        'company_name' => 'Test Workspace Ltd',
        'owner_name' => 'Owner',
        'owner_email' => "owner+{$slug}@example.test",
        'plan' => 'starter',
        'is_active' => true,
        'trial_ends_at' => now()->addDays(14),
    ], $overrides)));
}

/**
 * Section 13 -- shared by CarinaServiceTest (test_stream_chat_returns_sse_response)
 * and StreamingTest (test_stream_delivers_content_via_sse_chunks).
 */
function carina_assert_stream_chat_returns_sse(TestCase $test): void
{
    Http::preventStrayRequests();

    $groq = AiProvider::query()->where('slug', 'groq')->firstOrFail();
    $groq->update([
        'api_key' => 'gsk-stream-test',
        'api_base_url' => 'https://api.carina-stream.invalid/openai/v1',
        'is_enabled' => true,
    ]);

    Http::fake([
        'https://api.carina-stream.invalid/openai/v1/chat/completions' => Http::response([
            'choices' => [['message' => ['content' => 'Streamed body']]],
            'usage' => ['prompt_tokens' => 2, 'completion_tokens' => 4],
        ], 200),
    ]);

    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'Carina Stream '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@carina-stream.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $test->actingAs($user, 'web');

    $response = $test->post('http://'.$host.'/api/carina/chat/stream', [
        'message' => 'Ping',
    ], ['Accept' => 'text/event-stream']);

    $response->assertOk()
        ->assertHeader('Content-Type', 'text/event-stream; charset=UTF-8')
        ->assertHeader('X-Carina-Incognito', '0');

    $body = $response->streamedContent();

    expect($body)->toContain('data:')
        ->and($body)->toContain('Streamed body');
}
