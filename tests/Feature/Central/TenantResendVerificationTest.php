<?php

declare(strict_types=1);

use App\Mail\Tenant\WorkspaceEmailVerificationMail;
use App\Models\Central\FeatureFlag;
use App\Models\Central\PlatformUser;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Mail;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'saas_tenant_management')->update(['enabled' => true]);
    Mail::fake();
});

it('resends workspace verification email from saas tenancy edit', function (): void {
    Config::set('mail.default', 'array');

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Resend Verify Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@resend-verify.test',
        'plan' => 'starter',
        'send_welcome_email' => false,
    ]);

    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->post(route('admin.saas-tenancy.resend-verification', $tenant))
        ->assertRedirect()
        ->assertSessionHas('success');

    Mail::assertSent(WorkspaceEmailVerificationMail::class, fn (WorkspaceEmailVerificationMail $mail): bool => $mail->hasTo($tenant->owner_email));
});

it('forbids resend verification without manage permission', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'No Perm Verify Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@no-perm-verify.test',
        'plan' => 'starter',
        'send_welcome_email' => false,
    ]);

    $viewer = PlatformUser::factory()->create(['role' => 'support']);

    $this->actingAs($viewer, 'platform')
        ->post(route('admin.saas-tenancy.resend-verification', $tenant))
        ->assertForbidden();
});
