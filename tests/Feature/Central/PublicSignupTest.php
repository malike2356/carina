<?php

declare(strict_types=1);

use App\Mail\Tenant\WorkspaceEmailVerificationMail;
use App\Models\Central\Tenant;
use App\Models\Tenant\User;
use Illuminate\Support\Facades\Mail;

beforeEach(function (): void {
    Mail::fake();
});

it('provisions a workspace from the marketing signup api', function (): void {
    $response = $this->postJson('/api/v1/signup', [
        'first_name' => 'Alex',
        'last_name' => 'Investor',
        'email' => 'alex-investor-'.uniqid().'@example.test',
        'password' => 'password123',
        'company_name' => 'Alex Property Ltd',
        'workspace_slug' => 'alexprop'.random_int(1000, 9999),
        'plan' => 'investor',
    ], [
        'Origin' => 'http://localhost:8200',
    ]);

    $response->assertCreated()
        ->assertJsonPath('success', true);

    $slug = $response->json('tenant');
    expect($slug)->toBeString();

    $tenant = Tenant::query()->where('slug', $slug)->first();
    expect($tenant)->not->toBeNull()
        ->and($tenant->plan)->toBe('investor');

    tenancy()->initialize($tenant);
    $user = User::query()->where('email', $tenant->owner_email)->first();
    expect($user)->not->toBeNull()
        ->and($user->email_verified_at)->toBeNull();
    tenancy()->end();

    Mail::assertSent(WorkspaceEmailVerificationMail::class);
});

it('maps legacy mentor network plan to academy', function (): void {
    $email = 'mentor-'.uniqid().'@example.test';

    $this->postJson('/api/v1/signup', [
        'first_name' => 'Mentor',
        'last_name' => 'Lead',
        'email' => $email,
        'password' => 'password123',
        'company_name' => 'Mentor Academy Ltd',
        'plan' => 'mentor_network',
    ])->assertCreated();

    expect(Tenant::query()->where('owner_email', $email)->value('plan'))->toBe('academy');
});
