<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\User;
use App\Models\Tenant\Vcal\VcalAvailabilityRule;
use App\Models\Tenant\Vcal\VcalBlackoutDate;
use App\Models\Tenant\Vcal\VcalEventType;
use App\Services\Tenancy\TenantCreationService;
use Carbon\Carbon;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Tests\Concerns\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    Carbon::setTestNow(Carbon::parse('2026-05-04 12:00:00', 'UTC'));
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

afterEach(function (): void {
    Carbon::setTestNow();
});

it('supports full CRUD for viCal hub event types, availability rules, and blackouts', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'viCal CRUD '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@vical-crud.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'booking_calendar')->update(['enabled' => true]);

    $user = User::query()->firstOrFail();
    $user->booking_public_slug = 'crud-host';
    $user->save();

    $type = VcalEventType::query()->create([
        'user_id' => $user->id,
        'name' => 'Call',
        'slug' => 'call',
        'duration_minutes' => 30,
        'buffer_before_minutes' => 0,
        'buffer_after_minutes' => 0,
        'kind' => 'custom',
        'is_active' => true,
        'requires_host_approval' => false,
        'auto_zoom_meeting' => false,
        'deposit_minor' => null,
        'deposit_currency' => 'GBP',
    ]);

    $rule = VcalAvailabilityRule::query()->create([
        'user_id' => $user->id,
        'weekday' => 2,
        'starts_at' => '10:00:00',
        'ends_at' => '16:00:00',
        'timezone' => 'Europe/London',
        'is_active' => true,
    ]);

    $blackout = VcalBlackoutDate::query()->create([
        'user_id' => $user->id,
        'starts_on' => '2026-06-01',
        'ends_on' => '2026-06-03',
        'reason' => 'Holiday',
    ]);

    $eventTypeId = (int) $type->getKey();
    $ruleId = (int) $rule->getKey();
    $blackoutId = (int) $blackout->getKey();
    expect($eventTypeId)->toBeGreaterThan(0);

    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $index = $this->get('http://'.$host.'/vical');
    $index->assertOk();
    $index->assertSee('Call', false);

    $editType = $this->get('http://'.$host.'/vical/event-types/'.$eventTypeId.'/edit');
    $editType->assertOk();

    $putType = $this->put('http://'.$host.'/vical/event-types/'.$eventTypeId, [
        'name' => 'Investor call',
        'slug' => 'investor-call',
        'duration_minutes' => 45,
        'buffer_before_minutes' => 0,
        'buffer_after_minutes' => 0,
        'kind' => 'investor_call',
        'description' => null,
        'is_active' => '1',
        'requires_host_approval' => '1',
        'auto_zoom_meeting' => '0',
        'video_meeting_url' => '',
        'deposit_minor' => '500',
        'deposit_currency' => 'gbp',
        'intake_questions_json' => '[]',
    ]);
    $putType->assertRedirect(route('tenant.vical.index', [], false));
    $putType->assertSessionHas('status', 'event-type-updated');

    tenancy()->initialize($tenant);
    $type->refresh();
    expect($type->name)->toBe('Investor call')
        ->and($type->slug)->toBe('investor-call')
        ->and($type->duration_minutes)->toBe(45)
        ->and($type->requires_host_approval)->toBeTrue()
        ->and((int) $type->deposit_minor)->toBe(500)
        ->and($type->deposit_currency)->toBe('GBP');
    tenancy()->end();

    $editRule = $this->get('http://'.$host.'/vical/availability-rules/'.$ruleId.'/edit');
    $editRule->assertOk();

    $putRule = $this->put('http://'.$host.'/vical/availability-rules/'.$ruleId, [
        'weekday' => '3',
        'starts_at' => '09:00',
        'ends_at' => '17:00',
        'timezone' => 'Europe/London',
        'is_active' => '1',
    ]);
    $putRule->assertRedirect(route('tenant.vical.index', [], false));
    $putRule->assertSessionHas('status', 'availability-updated');

    tenancy()->initialize($tenant);
    $rule->refresh();
    expect($rule->weekday)->toBe(3)
        ->and((string) $rule->starts_at)->toStartWith('09:00:')
        ->and((string) $rule->ends_at)->toStartWith('17:00:');
    tenancy()->end();

    $editBo = $this->get('http://'.$host.'/vical/blackouts/'.$blackoutId.'/edit');
    $editBo->assertOk();

    $putBo = $this->put('http://'.$host.'/vical/blackouts/'.$blackoutId, [
        'starts_on' => '2026-07-10',
        'ends_on' => '2026-07-12',
        'reason' => 'Away',
    ]);
    $putBo->assertRedirect(route('tenant.vical.index', [], false));
    $putBo->assertSessionHas('status', 'blackout-updated');

    tenancy()->initialize($tenant);
    $blackout->refresh();
    expect($blackout->starts_on?->format('Y-m-d'))->toBe('2026-07-10')
        ->and($blackout->ends_on?->format('Y-m-d'))->toBe('2026-07-12')
        ->and($blackout->reason)->toBe('Away');
    tenancy()->end();
});
