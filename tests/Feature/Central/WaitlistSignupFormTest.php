<?php

declare(strict_types=1);

use App\Models\Central\WaitlistEntry;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Tests\Concerns\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('serves the html waitlist signup form and completes a browser signup', function (): void {
    $this->get(route('public.waitlist.signup.form'))
        ->assertOk()
        ->assertSee('Join the waitlist', false);

    $this->post(route('public.waitlist.signup'), [
        'email' => 'html-waiter@example.test',
        'name' => 'HTML Waiter',
        'user_type' => 'operator',
        'interests' => [],
    ])->assertRedirect(route('public.waitlist.thanks'));

    $this->followRedirects()->assertSee('Check your inbox', false);

    expect(WaitlistEntry::query()->where('email', 'html-waiter@example.test')->exists())->toBeTrue();
});
