<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;

it('purges expired platform password reset tokens on central connection', function (): void {
    DB::connection('central')->table('platform_password_reset_tokens')->delete();

    DB::connection('central')->table('platform_password_reset_tokens')->insert([
        ['email' => 'expired@test.com', 'token' => 'old', 'created_at' => now()->subHours(2)],
        ['email' => 'fresh@test.com',   'token' => 'new', 'created_at' => now()],
    ]);

    $this->artisan('auth:purge-expired-artifacts')->assertExitCode(0);

    $remaining = DB::connection('central')
        ->table('platform_password_reset_tokens')
        ->pluck('email')
        ->toArray();

    expect($remaining)->toBe(['fresh@test.com']);
});

it('does not delete anything in dry-run mode', function (): void {
    DB::connection('central')->table('platform_password_reset_tokens')->delete();

    DB::connection('central')->table('platform_password_reset_tokens')->insert([
        ['email' => 'expired@test.com', 'token' => 'old', 'created_at' => now()->subHours(2)],
    ]);

    $this->artisan('auth:purge-expired-artifacts --dry-run')->assertExitCode(0);

    $count = DB::connection('central')
        ->table('platform_password_reset_tokens')
        ->count();

    expect($count)->toBe(1);
});

it('reports count with dry-run without deleting', function (): void {
    DB::connection('central')->table('platform_password_reset_tokens')->delete();

    DB::connection('central')->table('platform_password_reset_tokens')->insert([
        ['email' => 'a@test.com', 'token' => 'x', 'created_at' => now()->subHours(3)],
        ['email' => 'b@test.com', 'token' => 'y', 'created_at' => now()->subHours(3)],
    ]);

    $this->artisan('auth:purge-expired-artifacts --dry-run')
        ->expectsOutputToContain('2')
        ->assertExitCode(0);
});

it('exits cleanly with zero tokens to purge', function (): void {
    DB::connection('central')->table('platform_password_reset_tokens')->delete();

    $this->artisan('auth:purge-expired-artifacts')->assertExitCode(0);
});
