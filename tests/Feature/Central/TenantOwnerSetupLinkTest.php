<?php

declare(strict_types=1);

use App\Mail\Central\TenantProvisionedWelcomeMail;
use App\Models\Central\FeatureFlag;
use App\Models\Central\PlatformUser;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Support\Facades\Mail;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'saas_tenant_management')->update(['enabled' => true]);
    Mail::fake();
});

it('sends owner password setup link from saas tenancy edit', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Setup Link Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@setup-link.test',
        'plan' => 'starter',
        'send_welcome_email' => false,
    ]);

    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->post(route('admin.saas-tenancy.send-owner-setup-link', $tenant))
        ->assertRedirect()
        ->assertSessionHas('success');

    Mail::assertSent(TenantProvisionedWelcomeMail::class, fn (TenantProvisionedWelcomeMail $mail): bool => $mail->hasTo($tenant->owner_email));
});

it('forbids send owner setup link without manage permission', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'No Perm Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@no-perm.test',
        'plan' => 'starter',
        'send_welcome_email' => false,
    ]);

    $viewer = PlatformUser::factory()->create(['role' => 'support']);

    $this->actingAs($viewer, 'platform')
        ->post(route('admin.saas-tenancy.send-owner-setup-link', $tenant))
        ->assertForbidden();
});
