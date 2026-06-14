<?php

declare(strict_types=1);

use App\Http\Controllers\Webhooks\CarinaWebhookController;
use App\Jobs\Carina\ProcessWebhookEventJob;
use App\Models\Central\FeatureFlag;
use App\Models\Central\Tenant;
use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\CarinaWebhook;
use App\Models\Tenant\TenantRole;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaModuleToolDispatcher;
use App\Services\Tenancy\TenantCreationService;
use Database\Factories\Tenant\UserFactory;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Str;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

/**
 * @return array{0: Tenant, 1: User, 2: CarinaConversation}
 */
function webhookToolTenant(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Webhooks '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@webhooks.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $conversation = CarinaConversation::query()->create([
        'tenant_id' => (string) $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Webhook thread',
    ]);

    tenancy()->end();

    return [$tenant, $user, $conversation];
}

it('creates a webhook and returns a valid URL', function (): void {
    [$tenant, $user, $conversation] = webhookToolTenant();
    tenancy()->initialize($tenant);

    $result = app(CarinaModuleToolDispatcher::class)->dispatch(
        'webhook_subscribe',
        [
            'name' => 'Portsmouth HMO listings',
            'event_type' => 'rightmove_listing',
            'trigger_prompt' => 'Summarise the listing and estimate BTL yield.',
            'delivery_channel' => 'web',
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['created'] ?? null)->toBeTrue()
        ->and($result->data['webhook_url'] ?? '')->toContain('/webhook/carina/')
        ->and(CarinaWebhook::query()->where('user_id', $user->id)->count())->toBe(1);

    tenancy()->end();
});

it('webhook controller returns 404 for unknown token', function (): void {
    [$tenant] = webhookToolTenant();
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    $this->postJson('http://'.$host.'/webhook/carina/'.str_repeat('x', 32), ['listing_id' => 1])
        ->assertNotFound();
});

it('webhook controller dispatches ProcessWebhookEventJob for valid token', function (): void {
    Bus::fake();

    [$tenant, $user, $conversation] = webhookToolTenant();
    tenancy()->initialize($tenant);

    app(CarinaModuleToolDispatcher::class)->dispatch(
        'webhook_subscribe',
        [
            'name' => 'Inbound test',
            'event_type' => 'custom',
            'trigger_prompt' => 'Summarise this event.',
        ],
        $user,
        $conversation,
    );

    $webhook = CarinaWebhook::query()->where('user_id', $user->id)->firstOrFail();
    $token = $webhook->secret_token;

    $payload = ['listing_id' => 1, 'address' => '14 Oak Street', 'price' => 185000];

    $request = Request::create(
        '/webhook/carina/'.$token,
        'POST',
        server: ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json'],
        content: json_encode($payload, JSON_THROW_ON_ERROR),
    );

    $response = app(CarinaWebhookController::class)->handle($request, $token);

    expect($response->getStatusCode())->toBe(200)
        ->and($response->getData(true))->toBe(['received' => true]);

    Bus::assertDispatched(ProcessWebhookEventJob::class, function (ProcessWebhookEventJob $job) use ($tenant, $webhook, $payload): bool {
        return $job->tenantId === (string) $tenant->getTenantKey()
            && $job->webhookId === (int) $webhook->id
            && $job->payload === $payload;
    });

    tenancy()->end();
});

it('list_webhooks returns only the current user webhooks', function (): void {
    [$tenant, $user, $conversation] = webhookToolTenant();
    tenancy()->initialize($tenant);

    TenantRole::findOrCreate('staff', 'web');
    $other = UserFactory::new()->createOne([
        'email' => 'staff-'.uniqid().'@webhooks.test',
        'password' => bcrypt('secret-secret-secret'),
    ]);
    $other->syncRoles(['staff']);

    CarinaWebhook::query()->create([
        'user_id' => $user->id,
        'name' => 'Mine',
        'event_type' => 'custom',
        'secret_token' => Str::random(32),
        'trigger_prompt' => 'Process mine.',
        'is_active' => true,
    ]);

    CarinaWebhook::query()->create([
        'user_id' => $other->id,
        'name' => 'Theirs',
        'event_type' => 'custom',
        'secret_token' => Str::random(32),
        'trigger_prompt' => 'Process theirs.',
        'is_active' => true,
    ]);

    $result = app(CarinaModuleToolDispatcher::class)->dispatch(
        'list_webhooks',
        [],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['webhooks'] ?? null)->toHaveCount(1)
        ->and($result->data['webhooks'][0]['name'] ?? null)->toBe('Mine');

    tenancy()->end();
});

it('delete_webhook removes a subscription owned by the user', function (): void {
    [$tenant, $user, $conversation] = webhookToolTenant();
    tenancy()->initialize($tenant);

    $webhook = CarinaWebhook::query()->create([
        'user_id' => $user->id,
        'name' => 'Delete me',
        'event_type' => 'boe_rate_change',
        'secret_token' => Str::random(32),
        'trigger_prompt' => 'Alert on rate change.',
        'is_active' => true,
    ]);

    $result = app(CarinaModuleToolDispatcher::class)->dispatch(
        'delete_webhook',
        ['webhook_id' => $webhook->id],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and(CarinaWebhook::query()->whereKey($webhook->id)->exists())->toBeFalse();

    tenancy()->end();
});
