<?php

declare(strict_types=1);

use App\Exceptions\Academy\InvalidSsoTokenException;
use App\Models\Tenant\User;
use App\Services\Academy\AcademySsoService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Support\Facades\DB;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
});

it('stores and consumes an academy sso token once', function (): void {
    $source = app(TenantCreationService::class)->createTenant([
        'company_name' => 'SSO Source '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'sso-src-'.uniqid().'@test.com',
        'plan' => 'starter',
    ]);

    $user = null;
    $source->run(function () use (&$user): void {
        $user = User::query()->firstOrFail();
    });

    $service = app(AcademySsoService::class);
    $token = $service->generateToken($user, $source);

    expect(DB::connection('central')->table('academy_sso_tokens')->count())->toBe(1);

    $payload = $service->consumeToken($token);
    expect($payload['email'])->toBe($user->email);

    expect(fn () => $service->consumeToken($token))->toThrow(InvalidSsoTokenException::class);
});
