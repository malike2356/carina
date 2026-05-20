<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\StaffPayrollRun;
use App\Services\Staff\PayrollScheduledRunService;
use App\Services\Staff\PayrollSettingsService;
use App\Services\Tenancy\TenantCreationService;
use Carbon\Carbon;
use Tests\Concerns\RefreshDatabase;

uses(RefreshDatabase::class);

it('creates a single draft payroll run on the scheduled trigger date', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Scheduled Payroll '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'sched-'.uniqid().'@payroll.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'hr_payroll')->update(['enabled' => true]);
    FeatureFlag::query()->where('key', 'hr_payroll_hmrc')->update(['enabled' => true]);

    $settings = app(PayrollSettingsService::class);
    $settings->update(
        autoPopulateLines: false,
        autoSendPayslips: false,
        scheduledPayDay: 28,
        scheduledDaysBefore: 5,
    );
    tenancy()->end();

    $payDay = Carbon::parse('2026-05-28');
    $trigger = $payDay->copy()->subDays(5);

    tenancy()->initialize($tenant);
    $first = app(PayrollScheduledRunService::class)->processForTenant($trigger);
    $second = app(PayrollScheduledRunService::class)->processForTenant($trigger);

    expect($first)->not->toBeNull()
        ->and($second)->toBeNull()
        ->and(StaffPayrollRun::query()->where('status', 'draft')->count())->toBe(1);

    tenancy()->end();
});

it('does not create a run when not on the trigger date', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'No Trigger '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'notrig-'.uniqid().'@payroll.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'hr_payroll')->update(['enabled' => true]);
    FeatureFlag::query()->where('key', 'hr_payroll_hmrc')->update(['enabled' => true]);

    $run = app(PayrollScheduledRunService::class)->processForTenant(Carbon::parse('2026-05-01'));
    expect($run)->toBeNull();
    tenancy()->end();
});
