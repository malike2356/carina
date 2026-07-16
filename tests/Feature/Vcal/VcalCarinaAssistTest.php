<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\User;
use App\Models\Tenant\Vcal\VcalEventType;
use App\Services\Carina\CarinaService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Tests\Concerns\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('returns Carina reply on public book assist when feature is enabled', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'viCal Assist '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@vical-assist.test',
        'plan' => 'starter',
    ]);

    $hostDomain = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'booking_calendar')->update(['enabled' => true]);
    FeatureFlag::query()->where('key', 'carina_ai')->update(['enabled' => true]);

    $user = User::query()->firstOrFail();
    $user->booking_public_slug = 'assist-host';
    $user->save();

    $type = VcalEventType::query()->create([
        'user_id' => $user->id,
        'name' => 'Strategy call',
        'slug' => 'strategy-call',
        'duration_minutes' => 45,
        'buffer_before_minutes' => 0,
        'buffer_after_minutes' => 0,
        'kind' => 'custom',
        'is_active' => true,
    ]);
    tenancy()->end();

    $this->mock(CarinaService::class, function ($mock): void {
        $mock->shouldReceive('complete')
            ->once()
            ->andReturn('Please bring your portfolio summary.');
    });

    $response = $this->postJson('http://'.$hostDomain.'/book/assist-host/assist', [
        'message' => 'What should I prepare?',
        'event_type_id' => $type->getKey(),
    ]);

    $response->assertOk()
        ->assertJsonPath('reply', 'Please bring your portfolio summary.');
});
