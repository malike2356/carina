<?php

declare(strict_types=1);

use App\Models\Tenant\MobileDevice;
use App\Models\Tenant\User;
use App\Services\Mobile\PushNotificationService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Support\Facades\Hash;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
});

it('returns false when push token is missing and skips HTTP', function (): void {
    $svc = app(PushNotificationService::class);
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Push test '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@push-skip.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->where('email', $tenant->owner_email)->firstOrFail();
    $user->forceFill(['password' => Hash::make('x')])->save();
    MobileDevice::query()->create([
        'user_id' => $user->id,
        'tenant_id' => (string) $tenant->id,
        'device_uuid' => '55555555-5555-5555-5555-555555555555',
        'device_type' => 'ios',
        'push_token' => null,
    ]);
    $device = MobileDevice::query()->firstWhere('device_uuid', '55555555-5555-5555-5555-555555555555');
    expect($device)->not->toBeNull();
    expect($svc->sendToDevice($device, 'T', 'B'))->toBeFalse();
    tenancy()->end();
});
