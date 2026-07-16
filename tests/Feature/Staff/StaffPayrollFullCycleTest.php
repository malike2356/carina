<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\GlAccount;
use App\Models\Tenant\JournalEntry;
use App\Models\Tenant\JournalLine;
use App\Models\Tenant\StaffPayrollLine;
use App\Models\Tenant\StaffPayrollRun;
use App\Models\Tenant\StaffProfile;
use App\Models\Tenant\TenantRole;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Factories\Tenant\UserFactory;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Tests\Concerns\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('runs the full payroll cycle from lines to paid', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Payroll Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@payroll.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->slug.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'hr_payroll')->update(['enabled' => true]);
    completeTenantWorkspaceOnboarding();

    $admin = User::query()->firstOrFail();
    TenantRole::findOrCreate('agent', 'web');
    $staff1 = UserFactory::new()->createOne(['name' => 'Staff One', 'email' => 'staff1-'.uniqid().'@payroll.test']);
    $staff2 = UserFactory::new()->createOne(['name' => 'Staff Two', 'email' => 'staff2-'.uniqid().'@payroll.test']);
    $staff1->syncRoles(['agent']);
    $staff2->syncRoles(['agent']);

    StaffProfile::query()->updateOrCreate(
        ['user_id' => $staff1->id],
        ['annual_salary_minor' => 3600000, 'pay_frequency' => 'monthly', 'pay_method' => 'bank_transfer'],
    );
    StaffProfile::query()->updateOrCreate(
        ['user_id' => $staff2->id],
        ['annual_salary_minor' => 2400000, 'pay_frequency' => 'monthly', 'pay_method' => 'bank_transfer'],
    );

    expect(GlAccount::query()->where('code', '1000')->exists())->toBeTrue();
    tenancy()->end();

    $periodStart = now()->startOfMonth()->toDateString();
    $periodEnd = now()->endOfMonth()->toDateString();

    $this->actingAs($admin, 'web');

    $create = $this->post('http://'.$host.'/staff/payroll', [
        'period_start' => $periodStart,
        'period_end' => $periodEnd,
        'currency' => 'GBP',
        'notes' => 'May cycle',
    ]);
    $create->assertRedirect();
    $showUrl = $create->headers->get('Location');
    expect($showUrl)->not->toBeNull();

    preg_match('#/staff/payroll/(\d+)#', (string) $showUrl, $matches);
    $runId = (int) ($matches[1] ?? 0);
    expect($runId)->toBeGreaterThan(0);

    $this->post('http://'.$host.'/staff/payroll/'.$runId.'/lines', [
        'user_id' => $staff1->id,
        'gross_minor' => 300000,
        'tax_minor' => 50000,
        'ni_minor' => 20000,
        'deductions_minor' => 0,
        'payment_method' => 'bank_transfer',
    ])->assertRedirect(route('tenant.staff.payroll.show', $runId, false));

    $this->post('http://'.$host.'/staff/payroll/'.$runId.'/lines', [
        'user_id' => $staff2->id,
        'gross_minor' => 200000,
        'tax_minor' => 30000,
        'ni_minor' => 10000,
        'deductions_minor' => 0,
        'payment_method' => 'bank_transfer',
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $run = StaffPayrollRun::query()->findOrFail($runId);
    expect($run->total_gross_minor)->toBe(500000)
        ->and($run->lines()->count())->toBe(2);
    tenancy()->end();

    $this->post('http://'.$host.'/staff/payroll/'.$runId.'/finalise')
        ->assertRedirect(route('tenant.staff.payroll.show', $runId, false));

    tenancy()->initialize($tenant);
    $run->refresh();
    expect($run->status)->toBe('finalised')
        ->and($run->journal_entry_id)->not->toBeNull();

    $wagesId = (int) GlAccount::query()->where('code', '5100')->value('id');
    $payableId = (int) GlAccount::query()->where('code', '2200')->value('id');
    $accrualLines = JournalLine::query()->where('journal_entry_id', $run->journal_entry_id)->get();
    expect($accrualLines->where('gl_account_id', $wagesId)->sum('debit_minor'))->toBe(500000)
        ->and($accrualLines->where('gl_account_id', $payableId)->sum('credit_minor'))->toBe(500000);
    tenancy()->end();

    $this->post('http://'.$host.'/staff/payroll/'.$runId.'/mark-paid')
        ->assertRedirect(route('tenant.staff.payroll.show', $runId, false));

    tenancy()->initialize($tenant);
    $run->refresh();
    expect($run->status)->toBe('paid')
        ->and($run->paid_at)->not->toBeNull();

    $bankId = (int) GlAccount::query()->where('code', '1000')->value('id');
    $paymentEntry = JournalEntry::query()
        ->where('reference', 'PAYROLL-PAY-'.$runId)
        ->first();
    expect($paymentEntry)->not->toBeNull();
    $paymentLines = JournalLine::query()->where('journal_entry_id', $paymentEntry->id)->get();
    expect($paymentLines->where('gl_account_id', $payableId)->sum('debit_minor'))->toBe(500000)
        ->and($paymentLines->where('gl_account_id', $bankId)->sum('credit_minor'))->toBe(500000);

    $line = StaffPayrollLine::query()->where('payroll_run_id', $runId)->where('user_id', $staff1->id)->first();
    tenancy()->end();

    $this->get('http://'.$host.'/staff/payroll/'.$runId.'/payslip/'.$staff1->id)
        ->assertOk()
        ->assertSee('2,500.00', false);

    $this->actingAs($staff1, 'web');
    $this->get('http://'.$host.'/staff/my-payslips')
        ->assertOk()
        ->assertSee('Staff One', false)
        ->assertSee('3,000.00', false);
});
