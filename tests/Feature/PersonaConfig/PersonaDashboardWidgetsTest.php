<?php

declare(strict_types=1);

use App\Models\Tenant\DashboardWidget;
use App\Services\Carina\AgencyCarinaContextService;
use App\Services\Carina\BridgeCarinaContextService;
use App\Services\Carina\BtlCarinaContextService;
use App\Services\Carina\ForgeCarinaContextService;
use App\Services\Carina\HallCarinaContextService;
use App\Services\Carina\LodgeCarinaContextService;
use App\Services\Carina\SourcerCarinaContextService;
use App\Services\Carina\StewardCarinaContextService;
use App\Services\Carina\Tools\Lodge\GetSaNightCountTool;
use App\Services\Persona\PersonaService;
use App\Services\Reporting\DashboardWidgetService;
use App\Services\Reporting\PersonaDashboardWidgetService;
use App\Services\Tenancy\TenantCreationService;

/**
 * @param  list<string>  $widgetTypes
 */
function assertPersonaDashboardWidgets(string $persona, array $widgetTypes, callable $payloadAssertions): void
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => ucfirst($persona).' Widgets '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => $persona.'-widgets-'.uniqid().'@persona.test',
        'plan' => 'professional',
        'persona' => $persona,
    ]);

    tenancy()->initialize($tenant);

    $service = app(PersonaService::class);
    expect($service->resolveSlug($tenant))->toBe($persona);

    $allowed = $service->allowedDashboardWidgetTypes($tenant);
    foreach ($widgetTypes as $type) {
        expect($allowed)->toContain($type);
    }

    $widgets = app(PersonaDashboardWidgetService::class);
    $payloadAssertions($widgets);

    $dashTypes = collect(app(DashboardWidgetService::class)->getWidgetData())->pluck('type')->all();
    foreach ($widgetTypes as $type) {
        expect($dashTypes)->toContain($type);
    }

    tenancy()->end();
}

it('btl persona widgets and carina context resolve', function (): void {
    assertPersonaDashboardWidgets('btl', ['property_summary', 'rent_overdue', 'upcoming_renewals'], function (PersonaDashboardWidgetService $w): void {
        expect($w->propertySummary())->toHaveKeys(['total', 'active', 'void']);
        expect($w->rentOverdue())->toHaveKeys(['count', 'total_arrears_pence']);
        expect($w->upcomingRenewals())->toHaveKeys(['count', 'next_renewal']);
        expect(app(BtlCarinaContextService::class)->build())->toBeString()->not->toBe('');
    });
});

it('sourcer persona widgets and carina context resolve', function (): void {
    assertPersonaDashboardWidgets('sourcer', ['pipeline_summary', 'deal_feed', 'lead_activity'], function (PersonaDashboardWidgetService $w): void {
        expect($w->dealFeed())->toHaveKey('deals');
        expect($w->leadActivity())->toHaveKeys(['new_contacts_30d', 'pipeline_moves_7d', 'total_pipeline_deals']);
        expect(app(SourcerCarinaContextService::class)->build())->toBeString()->not->toBe('');
    });
});

it('lodge persona widgets carina context and sa night tool', function (): void {
    assertPersonaDashboardWidgets('lodge', ['property_summary', 'compliance_summary', 'booking_overview', 'revenue_vs_target'], function (PersonaDashboardWidgetService $w): void {
        expect($w->bookingOverview())->toHaveKeys(['confirmed_this_month', 'upcoming_7d', 'pending_review']);
        expect($w->revenueVsTarget())->toHaveKeys(['month_revenue_pence', 'month_label']);
        expect(app(LodgeCarinaContextService::class)->build())->toBeString()->not->toBe('');
    });

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Lodge Tool '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'lodge-tool-'.uniqid().'@persona.test',
        'plan' => 'professional',
        'persona' => 'lodge',
    ]);
    tenancy()->initialize($tenant);
    $tool = app(GetSaNightCountTool::class);
    expect($tool->name())->toBe('get_sa_night_count');
    tenancy()->end();
});

it('steward persona widgets and carina context resolve', function (): void {
    assertPersonaDashboardWidgets('steward', [
        'block_compliance_overview',
        'open_maintenance',
        'service_charge_summary',
        'reserve_fund_balance',
    ], function (PersonaDashboardWidgetService $w): void {
        expect($w->blockComplianceOverview())->toHaveKeys(['total', 'valid', 'expiring_soon', 'expired']);
        expect($w->openMaintenance())->toHaveKeys(['open', 'overdue']);
        expect($w->serviceChargeSummary())->toHaveKeys(['collected_ytd_pence', 'open_s20_works']);
        expect($w->reserveFundBalance())->toHaveKey('balance_pence');
        expect(app(StewardCarinaContextService::class)->build())->toBeString()->not->toBe('');
    });
});

it('agency persona widgets and carina context resolve', function (): void {
    assertPersonaDashboardWidgets('agency', [
        'client_portfolio_overview',
        'compliance_summary',
        'fee_income_summary',
        'upcoming_renewals',
    ], function (PersonaDashboardWidgetService $w): void {
        expect($w->payload('client_portfolio_overview'))->toHaveKeys([
            'total_properties',
            'client_count',
            'active_tenancy_count',
        ]);
        expect($w->feeIncomeSummary())->toHaveKeys(['mtd_pence', 'month_label']);
        expect(app(AgencyCarinaContextService::class)->build())->toBeString()->not->toBe('');
    });
});

it('forge persona widgets and carina context resolve', function (): void {
    assertPersonaDashboardWidgets('forge', [
        'project_pipeline',
        'build_cost_vs_budget',
        'completion_forecast',
        'drawdown_tracker',
    ], function (PersonaDashboardWidgetService $w): void {
        expect($w->payload('project_pipeline'))->toHaveKey('active_projects');
        expect($w->buildCostVsBudget())->toHaveKeys(['total_budget_pence', 'total_spent_pence', 'variance_pence']);
        expect($w->completionForecast())->toHaveKeys(['active', 'on_track', 'overdue']);
        expect(app(ForgeCarinaContextService::class)->build())->toBeString()->not->toBe('');
    });
});

it('bridge persona widgets and carina context resolve', function (): void {
    assertPersonaDashboardWidgets('bridge', [
        'r2r_margin_summary',
        'rent_vs_sublease_income',
        'expiry_pipeline',
        'compliance_summary',
    ], function (PersonaDashboardWidgetService $w): void {
        expect($w->payload('r2r_margin_summary'))->toHaveKeys(['margin_mtd_pence', 'head_rent_mtd_pence']);
        expect($w->rentVsSubleaseIncome())->toHaveKeys(['head_rent_pence', 'sublease_pence', 'margin_pence']);
        expect($w->expiryPipeline())->toHaveKeys(['expiring_90d', 'nearest_expiry']);
        expect(app(BridgeCarinaContextService::class)->build())->toBeString()->not->toBe('');
    });
});

it('hall persona widgets and carina context resolve', function (): void {
    assertPersonaDashboardWidgets('hall', [
        'student_occupancy_board',
        'semester_income_forecast',
        'void_summer_alert',
        'compliance_summary',
    ], function (PersonaDashboardWidgetService $w): void {
        expect($w->studentOccupancyBoard())->toHaveKeys(['total_properties', 'occupied', 'void', 'semester_label']);
        expect($w->semesterIncomeForecast())->toHaveKeys(['income_pence', 'semester_label', 'academic_year']);
        expect($w->voidSummerAlert())->toHaveKeys(['summer_void_alert', 'void_count', 'semester']);
        expect(app(HallCarinaContextService::class)->build())->toBeString()->not->toBe('');
    });
});

it('creates dashboard widget records for persona allowed types', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Widget Records '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'widget-rec-'.uniqid().'@persona.test',
        'plan' => 'professional',
        'persona' => 'btl',
    ]);

    tenancy()->initialize($tenant);
    app(DashboardWidgetService::class)->getWidgetData();

    expect(
        DashboardWidget::query()->where('type', 'property_summary')->exists()
    )->toBeTrue();

    tenancy()->end();
});
