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

it('rejects duplicate owner email without creating another workspace', function (): void {
    $email = 'duplicate-owner-'.uniqid().'@example.test';

    $first = $this->postJson('/api/v1/signup', [
        'first_name' => 'First',
        'last_name' => 'Tenant',
        'email' => $email,
        'password' => 'password123',
        'company_name' => 'First Workspace Ltd',
        'workspace_slug' => 'firstws'.random_int(1000, 9999),
        'plan' => 'investor',
    ], [
        'Origin' => 'http://localhost:8200',
    ])->assertCreated();

    $slug = $first->json('tenant');

    expect(Tenant::query()->whereRaw('LOWER(owner_email) = ?', [strtolower($email)])->count())->toBe(1);

    $this->postJson('/api/v1/signup', [
        'first_name' => 'Second',
        'last_name' => 'Tenant',
        'email' => strtoupper($email),
        'password' => 'password123',
        'company_name' => 'Second Workspace Ltd',
        'workspace_slug' => 'secondws'.random_int(1000, 9999),
        'plan' => 'investor',
    ], [
        'Origin' => 'http://localhost:8200',
    ])
        ->assertUnprocessable()
        ->assertJsonPath('success', false)
        ->assertJsonPath('errors.email.0', 'An account with this email already exists.')
        ->assertJsonPath('tenant', $slug)
        ->assertJson(fn ($json) => $json->whereType('login_url', 'string')->etc());

    expect(Tenant::query()->whereRaw('LOWER(owner_email) = ?', [strtolower($email)])->count())->toBe(1);
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
