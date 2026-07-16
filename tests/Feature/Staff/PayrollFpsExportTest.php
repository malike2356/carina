<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\PayrollEmployerSetting;
use App\Models\Tenant\PayrollFpsSubmission;
use App\Models\Tenant\StaffPayrollLine;
use App\Models\Tenant\StaffPayrollRun;
use App\Models\Tenant\User;
use App\Services\Staff\PayrollFpsExportService;
use App\Services\Tenancy\TenantCreationService;
use Database\Factories\Tenant\UserFactory;
use Tests\Concerns\RefreshDatabase;

uses(RefreshDatabase::class);

it('builds FPS export payload for a finalised run', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'FPS Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'fps-'.uniqid().'@payroll.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'hr_payroll')->update(['enabled' => true]);
    FeatureFlag::query()->where('key', 'hr_payroll_hmrc')->update(['enabled' => true]);

    PayrollEmployerSetting::query()->create([
        'paye_reference' => '123/AB456',
        'accounts_office_reference' => 'AO123',
        'tax_year' => '2024-25',
        'rti_provider' => 'manual_export',
    ]);

    $staff = UserFactory::new()->createOne(['name' => 'FPS Staff']);

    $run = StaffPayrollRun::query()->create([
        'period_start' => now()->startOfMonth(),
        'period_end' => now()->endOfMonth(),
        'status' => 'finalised',
        'currency' => 'GBP',
        'total_gross_minor' => 300_000,
        'created_by_user_id' => User::query()->first()?->id,
    ]);

    StaffPayrollLine::query()->create([
        'payroll_run_id' => $run->id,
        'user_id' => $staff->id,
        'gross_minor' => 300_000,
        'tax_minor' => 39_050,
        'ni_minor' => 15_620,
        'deductions_minor' => 0,
        'net_minor' => 245_330,
        'payment_method' => 'bank_transfer',
    ]);

    $built = app(PayrollFpsExportService::class)->buildForRun($run->fresh());

    expect($built['submission'])->toBeInstanceOf(PayrollFpsSubmission::class)
        ->and($built['submission']->status)->toBe('manual_export')
        ->and($built['json'])->toContain('fps_manual_export_v1')
        ->and($built['json'])->toContain('123/AB456')
        ->and($built['xml'])->toContain('FullPaymentSubmission')
        ->and($built['xml'])->toContain('FPS Staff');

    tenancy()->end();
});

it('rejects FPS export for draft runs', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'FPS Draft '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'fpsd-'.uniqid().'@payroll.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    $run = StaffPayrollRun::query()->create([
        'period_start' => now()->startOfMonth(),
        'period_end' => now()->endOfMonth(),
        'status' => 'draft',
        'currency' => 'GBP',
        'total_gross_minor' => 0,
    ]);

    app(PayrollFpsExportService::class)->buildForRun($run);
})->throws(RuntimeException::class);
