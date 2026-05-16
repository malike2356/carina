<?php

declare(strict_types=1);

use App\Mail\Staff\StaffPayslipMail;
use App\Models\Central\FeatureFlag;
use App\Models\Central\Tenant;
use App\Models\Tenant\StaffPayrollLine;
use App\Models\Tenant\StaffPayrollRun;
use App\Models\Tenant\User;
use App\Services\Staff\PayrollSettingsService;
use App\Services\Tenancy\TenantCreationService;
use Database\Factories\Tenant\UserFactory;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Facades\Mail;
use Tests\Concerns\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
    Mail::fake();
});

it('downloads a payslip pdf for a finalised run', function (): void {
    [$host, $admin, $run, $staff] = seedPayrollRunForPayslip('finalised');

    $this->actingAs($admin, 'web')
        ->get('http://'.$host.'/staff/payroll/'.$run->id.'/payslip/'.$staff->id.'/download')
        ->assertOk()
        ->assertHeader('content-type', 'application/pdf');
});

it('emails a payslip to staff', function (): void {
    [$host, $admin, $run, $staff] = seedPayrollRunForPayslip('finalised');

    $this->actingAs($admin, 'web')
        ->post('http://'.$host.'/staff/payroll/'.$run->id.'/payslip/'.$staff->id.'/send')
        ->assertRedirect();

    Mail::assertSent(StaffPayslipMail::class, function (StaffPayslipMail $mail) use ($staff): bool {
        return $mail->hasTo($staff->email);
    });

    $tenant = Tenant::query()->where('slug', explode('.', $host)[0])->firstOrFail();
    tenancy()->initialize($tenant);
    $line = StaffPayrollLine::query()->where('payroll_run_id', $run->id)->where('user_id', $staff->id)->first();
    expect($line?->payslip_sent_at)->not->toBeNull();
    tenancy()->end();
});

it('auto-sends payslips when marking paid with workspace setting enabled', function (): void {
    [$host, $admin, $run, $staff] = seedPayrollRunForPayslip('finalised');

    $tenant = Tenant::query()->where('slug', explode('.', $host)[0])->firstOrFail();
    tenancy()->initialize($tenant);
    app(PayrollSettingsService::class)->update(true, true);
    tenancy()->end();

    $this->actingAs($admin, 'web')
        ->post('http://'.$host.'/staff/payroll/'.$run->id.'/mark-paid')
        ->assertRedirect();

    Mail::assertSent(StaffPayslipMail::class, function (StaffPayslipMail $mail) use ($staff): bool {
        return $mail->hasTo($staff->email);
    });
});

it('blocks staff from viewing draft payslips', function (): void {
    [$host, $admin, $run, $staff] = seedPayrollRunForPayslip('draft');

    $this->actingAs($staff, 'web')
        ->get('http://'.$host.'/staff/payroll/'.$run->id.'/payslip/'.$staff->id)
        ->assertForbidden();
});

/**
 * @return array{0: string, 1: User, 2: StaffPayrollRun, 3: User}
 */
function seedPayrollRunForPayslip(string $status): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Payslip Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@payslip.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->slug.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'hr_payroll')->update(['enabled' => true]);
    completeTenantWorkspaceOnboarding();

    $admin = User::query()->firstOrFail();
    $staff = UserFactory::new()->createOne([
        'name' => 'Pay Staff',
        'email' => 'paystaff-'.uniqid().'@payslip.test',
    ]);

    $run = StaffPayrollRun::query()->create([
        'period_start' => now()->startOfMonth(),
        'period_end' => now()->endOfMonth(),
        'status' => $status,
        'currency' => 'GBP',
        'total_gross_minor' => 250000,
        'created_by_user_id' => $admin->id,
    ]);

    StaffPayrollLine::query()->create([
        'payroll_run_id' => $run->id,
        'user_id' => $staff->id,
        'gross_minor' => 250000,
        'tax_minor' => 50000,
        'ni_minor' => 20000,
        'deductions_minor' => 0,
        'net_minor' => 180000,
        'payment_method' => 'bank_transfer',
    ]);

    tenancy()->end();

    return [$host, $admin, $run, $staff];
}
