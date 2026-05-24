<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\DashboardWidget;
use App\Models\Tenant\Property;
use App\Models\Tenant\ReportDefinition;
use App\Models\Tenant\ReportExecution;
use App\Models\Tenant\User;
use App\Services\Reporting\AnalyticsService;
use App\Services\Reporting\CustomReportBuilderService;
use App\Services\Reporting\DashboardWidgetService;
use App\Services\Reporting\ExportService;
use App\Services\Reporting\ReportGenerationService;
use App\Services\Tenancy\TenantCreationService;
use App\Support\Reporting\ReportTypes;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;

it('covers reporting HTTP API and tenant services in one lifecycle', function (): void {
    Mail::fake();
    Cache::flush();

    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::on('central')->where('key', 'reporting_intelligence')->update(['enabled' => true]);

    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'Reporting Mod '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@rpt-mod.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $create = $this->postJson('http://'.$host.'/api/reports/definitions', [
        'name' => 'Portfolio export',
        'type' => ReportTypes::PROPERTY_PORTFOLIO,
        'filters' => [],
    ]);
    $create->assertCreated();
    $defId = $create->json('data.id');
    expect($defId)->not->toBeNull();

    $this->getJson('http://'.$host.'/api/reports/definitions/'.$defId)->assertOk();

    $genResp = $this->postJson('http://'.$host.'/api/reports/definitions/'.$defId.'/generate', [
        'format' => 'csv',
        'sync' => true,
    ]);
    $genResp->assertOk();
    expect($genResp->json('data.status'))->toBe('completed');

    $this->deleteJson('http://'.$host.'/api/reports/definitions/'.$defId)->assertNoContent();

    $sched = $this->postJson('http://'.$host.'/api/reports/scheduled', [
        'name' => 'Weekly compliance',
        'type' => ReportTypes::COMPLIANCE_STATUS,
        'schedule' => 'weekly',
        'recipients' => ['sched@example.test'],
    ]);
    $sched->assertCreated();
    $schedId = $sched->json('data.id');
    expect($schedId)->not->toBeNull();

    $this->postJson('http://'.$host.'/api/reports/scheduled/'.$schedId.'/toggle')->assertOk();

    tenancy()->initialize($tenant);
    expect(ReportDefinition::query()->find($schedId)?->schedule_enabled)->toBeFalse();

    $this->postJson('http://'.$host.'/api/reports/scheduled/'.$schedId.'/toggle')->assertOk();
    expect(ReportDefinition::query()->find($schedId)?->schedule_enabled)->toBeTrue();

    $this->deleteJson('http://'.$host.'/api/reports/scheduled/'.$schedId)->assertOk();
    expect(ReportDefinition::query()->find($schedId)?->schedule)->toBeNull();

    Property::query()->create([
        'address_line1' => '1 Test Row',
        'city' => 'Leeds',
        'postcode' => 'LS1 1AA',
        'property_type' => 'terraced',
        'status' => 'lead',
        'created_by' => $user->id,
    ]);

    $builder = new CustomReportBuilderService;
    expect($builder->buildDataset(ReportTypes::PROPERTY_PORTFOLIO, [])['headers'])->not->toBeEmpty();

    $def = ReportDefinition::query()->create([
        'name' => 'Svc test',
        'type' => ReportTypes::PROPERTY_PORTFOLIO,
        'filters' => [],
        'columns' => null,
        'schedule' => 'weekly',
        'schedule_enabled' => true,
        'recipients' => ['a@example.test'],
        'created_by' => $user->id,
    ]);

    $gen = new ReportGenerationService($builder, app(ExportService::class));
    $ex = $gen->generateReport($def, 'csv', true);
    expect($ex->status)->toBe(ReportExecution::STATUS_COMPLETED);
    $gen->sendReport($ex, ['recipient@example.test'], 'Subject');

    $analytics = new AnalyticsService;
    $analytics->trackEvent($user->id, 'session.active', [], false);
    expect($analytics->metrics()['events_last_24h'])->toBeGreaterThanOrEqual(1);

    $dw = DashboardWidget::query()->create([
        'type' => 'kpi_properties',
        'title' => 'Props',
        'configuration' => [],
        'position' => 0,
        'is_visible' => true,
    ]);

    $widgets = app(DashboardWidgetService::class);
    expect($widgets->getWidgetData())->not->toBeEmpty();
    Cache::put('reporting:widget:'.$dw->id, ['x' => true], 600);
    $widgets->refreshWidgets();
    expect(Cache::has('reporting:widget:'.$dw->id))->toBeFalse();

    tenancy()->end();
});
