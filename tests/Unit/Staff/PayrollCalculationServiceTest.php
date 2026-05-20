<?php

declare(strict_types=1);

use App\Models\Tenant\EmployeeTaxProfile;
use App\Services\Staff\PayrollCalculationService;

it('calculates monthly PAYE and NI for tax code 1257L at 3000 gross', function (): void {
    $service = app(PayrollCalculationService::class);

    $profile = new EmployeeTaxProfile([
        'tax_code' => '1257L',
        'ni_category' => 'A',
        'student_loan_plan' => 'none',
        'week1_month1' => false,
    ]);

    $result = $service->calculateMonthly(300_000, $profile);

    expect($result['tax_minor'])->toBe(39_050)
        ->and($result['ni_minor'])->toBe(15_620)
        ->and($result['net_minor'])->toBe(245_330);
});

it('applies BR tax code with no personal allowance', function (): void {
    $service = app(PayrollCalculationService::class);

    $profile = new EmployeeTaxProfile([
        'tax_code' => 'BR',
        'ni_category' => 'A',
    ]);

    $result = $service->calculateMonthly(200_000, $profile);

    expect($result['tax_minor'])->toBe(40_000)
        ->and($result['monthly_allowance_minor'])->toBe(0);
});

it('parses allowance from numeric tax codes', function (): void {
    $service = app(PayrollCalculationService::class);

    expect($service->monthlyAllowanceFromCode('1257L'))->toBe(104_750);
});
