<?php

declare(strict_types=1);

use App\Mail\Waitlist\WaitlistConfirmationMailable;
use App\Models\Central\WaitlistEntry;
use App\Models\Central\PlatformUser;
use Illuminate\Support\Facades\Mail;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\postJson;

function marketingWaitlistPayload(array $overrides = []): array
{
    return array_merge([
        'first_name' => 'Jane',
        'last_name' => 'Lead',
        'email' => 'jane.lead@example.test',
        'phone' => '+44 7700 900123',
        'role' => 'sa_operator',
        'plan' => 'operator',
        'message' => 'Need compliance tracking across portfolios.',
        'consent' => true,
        'source' => 'propreneur_waitlist',
    ], $overrides);
}

it('accepts marketing waitlist signups into the central waitlist table', function (): void {
    Mail::fake();

    postJson(route('api.v1.waitlist'), marketingWaitlistPayload())
        ->assertCreated()
        ->assertJson([
            'success' => true,
        ]);

    $entry = WaitlistEntry::query()->where('email', 'jane.lead@example.test')->firstOrFail();

    expect($entry->name)->toBe('Jane Lead')
        ->and($entry->user_type)->toBe('operator')
        ->and($entry->interests)->toMatchArray([
            'channel' => 'marketing_api',
            'source' => 'propreneur_waitlist',
            'marketing_role' => 'sa_operator',
            'interested_plan' => 'operator',
            'phone' => '+44 7700 900123',
            'challenge' => 'Need compliance tracking across portfolios.',
        ])
        ->and($entry->interest_score)->toBeGreaterThan(0);

    Mail::assertSent(WaitlistConfirmationMailable::class);
});

it('shows marketing waitlist leads on the platform admin waitlist page', function (): void {
    Mail::fake();

    postJson(route('api.v1.waitlist'), marketingWaitlistPayload([
        'email' => 'admin.visible@example.test',
        'first_name' => 'Visible',
        'last_name' => 'Lead',
    ]))->assertCreated();

    $admin = PlatformUser::factory()->superAdmin()->create();

    actingAs($admin, 'platform')
        ->get(route('admin.waitlist.index'))
        ->assertOk()
        ->assertSee('admin.visible@example.test', false)
        ->assertSee('Visible Lead', false)
        ->assertSee('propreneur_waitlist', false);
});

it('rejects invalid marketing waitlist payloads', function (): void {
    postJson(route('api.v1.waitlist'), [
        'first_name' => 'Jane',
        'email' => 'not-an-email',
        'role' => 'sa_operator',
        'plan' => 'operator',
        'consent' => true,
    ])
        ->assertUnprocessable()
        ->assertJson([
            'success' => false,
        ]);

    expect(WaitlistEntry::query()->where('email', 'not-an-email')->exists())->toBeFalse();
});

it('returns a friendly error when the email is already confirmed on the waitlist', function (): void {
    Mail::fake();

    WaitlistEntry::factory()->confirmed()->create([
        'email' => 'confirmed@example.test',
    ]);

    postJson(route('api.v1.waitlist'), marketingWaitlistPayload([
        'email' => 'confirmed@example.test',
    ]))
        ->assertUnprocessable()
        ->assertJson([
            'success' => false,
            'message' => 'This email is already on the waitlist.',
        ]);
});
