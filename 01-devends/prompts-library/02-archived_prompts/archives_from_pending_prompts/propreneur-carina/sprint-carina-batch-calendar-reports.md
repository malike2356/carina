# Sprint: Carina Batch Operations, Calendar, and Reports

**Status: COMPLETED 2026-07-26**

**What was built:**
- Implemented and archived

> Shared preflight: read `README.md` in this folder before implementing. Target `/opt/lampp/htdocs/verlox/propreneur/propreneur-v2`. Verify existing Laravel models, migrations, dispatcher, prompt registry, tenant boundaries, and tests before using any code snippet. Treat snippets as implementation sketches, not blind copy/paste.

## What This Builds

Three high-impact capabilities in one handler:

1. **Batch Operations**: "Mark all July rents as paid" or "Check compliance across all 12 properties" - one command, portfolio-wide.
2. **Calendar/Scheduling**: Carina tracks key dates (compliance expiry, tenancy renewals, inspections) and answers "what's happening next week?"
3. **Report Export**: "Email me a portfolio summary PDF" - Carina generates and sends it.

## Prerequisites

- The document upload, tenant communication, property operations, deal analysis, and email actions sprints must be complete
- PDF generation: barryvdh/laravel-dompdf or similar
- Existing portfolio data in Property, Tenant, RentPayment, ComplianceRecord models

## Part 1: Tool Handler

Create `app/Services/Carina/ToolHandlers/BatchOpsHandler.php`:

```php
<?php

declare(strict_types=1);

namespace App\Services\Carina\ToolHandlers;

use App\Models\Tenant\ComplianceRecord;
use App\Models\Tenant\Property;
use App\Models\Tenant\RentPayment;
use App\Models\Tenant\Tenant;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaConversation;
use App\Services\Carina\ToolResult;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Mail;
use Carbon\Carbon;

final class BatchOpsHandler extends AbstractModuleToolHandler
{
  protected array $tools = [
    'batch_mark_rent',
    'batch_compliance_check',
    'upcoming_events',
    'generate_report',
    'portfolio_health',
  ];

  public function __construct() {}

  public function handle(string $name, array $args, ?User $user, CarinaConversation $conversation): ToolResult
  {
    try {
      return match ($name) {
        'batch_mark_rent' => $this->batchMarkRent($args, $user),
        'batch_compliance_check' => $this->batchCompliance($args),
        'upcoming_events' => $this->upcomingEvents(),
        'generate_report' => $this->generateReport($args, $user),
        'portfolio_health' => $this->portfolioHealth(),
        default => $this->fail('Unsupported tool.'),
      };
    } catch (\Throwable $e) {
      return $this->fail($e->getMessage(), 'execution_error');
    }
  }

  /**
  * Batch mark rent as paid for multiple properties or all active.
  */
  private function batchMarkRent(array $args, ?User $user): ToolResult
  {
    $month = $args['month'] ?? now()->format('Y-m');
    $propertyIds = $args['property_ids'] ?? null;
    $amount = $args['amount'] ?? null;

    $query = Tenant::where('is_active', true);
    if ($propertyIds) {
      $ids = is_array($propertyIds) ? $propertyIds : explode(',', $propertyIds);
      $query->whereIn('property_id', $ids);
    }

    $tenants = $query->with('property')->get();
    $recorded = [];
    $skipped = [];

    foreach ($tenants as $tenant) {
      $existing = RentPayment::where('property_id', $tenant->property_id)
      ->where('payment_month', $month)
      ->where('status', 'paid')
      ->exists();

      if ($existing) {
        $skipped[] = $tenant->property->address_line_1;
        continue;
      }

      $paymentAmount = $amount ?? $tenant->monthly_rent ?? 0;
      RentPayment::create([
          'property_id' => $tenant->property_id,
          'tenant_id' => $tenant->id,
          'amount' => $paymentAmount,
          'payment_date' => now(),
          'payment_month' => $month,
          'method' => 'bank_transfer',
          'status' => 'paid',
          'recorded_by_user_id' => $user?->id,
      ]);

      $recorded[] = "{$tenant->property->address_line_1} - £{$paymentAmount}";
    }

    return $this->success([
        'month' => $month,
        'recorded' => $recorded,
        'recorded_count' => count($recorded),
        'skipped' => $skipped,
        'skipped_count' => count($skipped),
        'message' => count($recorded) . " rent payments recorded for {$month}. " . count($skipped) . " already marked as paid.",
    ]);
  }

  /**
  * Batch check compliance across all properties.
  */
  private function batchCompliance(array $args): ToolResult
  {
    $days = (int) ($args['days'] ?? 30);

    $expiring = ComplianceRecord::with('property')
    ->where('expiry_date', '<=', now()->addDays($days))
    ->where('expiry_date', '>=', now())
    ->orderBy('expiry_date')
    ->get();

    $expired = ComplianceRecord::with('property')
    ->where('expiry_date', '<', now())
    ->orderBy('expiry_date')
    ->get();

    $byProperty = [];
    foreach ($expiring as $record) {
      $prop = $record->property?->address_line_1 ?? 'Unknown';
      $byProperty[$prop][] = [
        'type' => $record->type,
        'expires' => $record->expiry_date->toDateString(),
        'days_left' => (int) now()->diffInDays($record->expiry_date, false),
      ];
    }

    return $this->success([
        'expiring_soon' => $expiring->count(),
        'expired' => $expired->count(),
        'breakdown' => $byProperty,
        'worst_offenders' => $expired->map(fn($r) => "{$r->property?->address_line_1}: {$r->type} expired {$r->expiry_date->toDateString()}")->toArray(),
        'message' => "{$expiring->count()} documents expiring within {$days} days. {$expired->count()} already expired.",
    ]);
  }

  /**
  * Get upcoming events: compliance deadlines, tenancy renewals, scheduled inspections.
  */
  private function upcomingEvents(): ToolResult
  {
    $events = [];

    // Compliance expiring in next 60 days
    $compliance = ComplianceRecord::with('property')
    ->where('expiry_date', '>=', now())
    ->where('expiry_date', '<=', now()->addDays(60))
    ->orderBy('expiry_date')
    ->get();

    foreach ($compliance as $c) {
      $events[] = [
        'date' => $c->expiry_date->toDateString(),
        'type' => 'compliance',
        'property' => $c->property?->address_line_1 ?? 'Unknown',
        'detail' => "{$c->type} expires",
        'days_away' => (int) now()->diffInDays($c->expiry_date, false),
      ];
    }

    // Tenancy renewals expiring in next 90 days
    $tenancies = Tenant::where('is_active', true)
    ->whereNotNull('tenancy_end')
    ->where('tenancy_end', '>=', now())
    ->where('tenancy_end', '<=', now()->addDays(90))
    ->with('property')
    ->orderBy('tenancy_end')
    ->get();

    foreach ($tenancies as $t) {
      $events[] = [
        'date' => $t->tenancy_end->toDateString(),
        'type' => 'tenancy_renewal',
        'property' => $t->property?->address_line_1 ?? 'Unknown',
        'detail' => "Tenancy for {$t->name} ends",
        'days_away' => (int) now()->diffInDays($t->tenancy_end, false),
      ];
    }

    // Sort by date
    usort($events, fn($a, $b) => $a['date'] <=> $b['date']);

    $thisWeek = array_filter($events, fn($e) => $e['days_away'] <= 7);
    $thisMonth = array_filter($events, fn($e) => $e['days_away'] <= 30);

    return $this->success([
        'this_week' => array_values($thisWeek),
        'this_month' => array_values($thisMonth),
        'all_upcoming' => $events,
        'message' => count($thisWeek) . " events this week, " . count($thisMonth) . " this month.",
    ]);
  }

  /**
  * Generate and email a portfolio report PDF.
  */
  private function generateReport(array $args, ?User $user): ToolResult
  {
    $reportType = $args['report_type'] ?? 'summary';
    $sendTo = $args['send_to'] ?? $user?->email;
    $propertyIds = $args['property_ids'] ?? null;

    $data = $this->buildReportData($reportType, $propertyIds);

    $pdf = Pdf::loadView('reports.portfolio-' . $reportType, $data);
    $filename = "portfolio-{$reportType}-" . now()->format('Y-m-d') . '.pdf';
    $path = storage_path("app/reports/{$filename}");
    $pdf->save($path);

    if ($sendTo) {
      Mail::raw("Your portfolio {$reportType} report is attached.", function ($message) use ($sendTo, $path, $filename) {
          $message->to($sendTo)
          ->subject("Propreneur Report: Portfolio {$reportType} - " . now()->format('d M Y'))
          ->attach($path);
      });
    }

    return $this->success([
        'report_type' => $reportType,
        'filename' => $filename,
        'sent_to' => $sendTo,
        'properties_included' => $data['property_count'] ?? 0,
        'message' => "Portfolio {$reportType} report generated" . ($sendTo ? " and sent to {$sendTo}" : "") . ".",
    ]);
  }

  /**
  * Portfolio health score - one number that tells the landlord how healthy their portfolio is.
  */
  private function portfolioHealth(): ToolResult
  {
    $totalProperties = Property::count();
    $activeTenants = Tenant::where('is_active', true)->count();
    $vacantProperties = $totalProperties - Property::whereHas('tenants', fn($q) => $q->where('is_active', true))->count();

    // Rent collection rate
    $currentMonth = now()->format('Y-m');
    $expectedRent = Tenant::where('is_active', true)->sum('monthly_rent');
    $collectedRent = RentPayment::where('payment_month', $currentMonth)->where('status', 'paid')->sum('amount');
    $collectionRate = $expectedRent > 0 ? round(($collectedRent / $expectedRent) * 100) : 0;

    // Compliance score
    $totalComplianceItems = ComplianceRecord::count();
    $expiredCompliance = ComplianceRecord::where('expiry_date', '<', now())->count();
    $complianceScore = $totalComplianceItems > 0 ? round((1 - ($expiredCompliance / $totalComplianceItems)) * 100) : 100;

    // Overall health
    $healthScore = round(($collectionRate + $complianceScore + ($vacantProperties === 0 ? 100 : 50)) / 3);

    $issues = [];
    if ($vacantProperties > 0) $issues[] = "{$vacantProperties} vacant properties";
    if ($collectionRate < 90) $issues[] = "Rent collection at {$collectionRate}%";
    if ($expiredCompliance > 0) $issues[] = "{$expiredCompliance} expired compliance items";

    return $this->success([
        'health_score' => $healthScore,
        'rating' => $healthScore >= 85 ? 'Healthy' : ($healthScore >= 60 ? 'Needs Attention' : 'At Risk'),
        'metrics' => [
          'vacant_properties' => $vacantProperties,
          'rent_collection_rate' => $collectionRate . '%',
          'compliance_rate' => $complianceScore . '%',
        ],
        'issues' => $issues,
        'message' => "Portfolio health: {$healthScore}/100 - " . ($healthScore >= 85 ? 'Healthy' : ($healthScore >= 60 ? 'Needs Attention' : 'At Risk')) . ". " . (count($issues) > 0 ? 'Issues: ' . implode('; ', $issues) . '.' : 'No issues detected.'),
    ]);
  }

  private function buildReportData(string $type, ?string $propertyIds): array
  {
    $query = Property::query();
    if ($propertyIds) {
      $query->whereIn('id', explode(',', $propertyIds));
    }
    $properties = $query->with(['tenants', 'complianceRecords'])->get();

    $currentMonth = now()->format('Y-m');
    $totalRent = Tenant::where('is_active', true)->sum('monthly_rent');
    $collectedRent = RentPayment::where('payment_month', $currentMonth)->where('status', 'paid')->sum('amount');

    return [
      'properties' => $properties,
      'property_count' => $properties->count(),
      'total_monthly_rent' => $totalRent,
      'collected_this_month' => $collectedRent,
      'generated_at' => now()->toDateTimeString(),
    ];
  }
}
```

## Part 2: Report Blade Template

Create `resources/views/reports/portfolio-summary.blade.php`:

```blade
<!DOCTYPE html>
<html>
<head>
 <title>Portfolio Summary - {{ $generated_at }}</title>
 <style>
 body { font-family: sans-serif; font-size: 12px; }
 table { width: 100%; border-collapse: collapse; margin: 10px 0; }
 th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
 th { background: #f5f5f5; }
 .summary { background: #e8f5e9; padding: 12px; margin: 10px 0; border-radius: 4px; }
 .warning { color: #e65100; }
 .danger { color: #c62828; }
 </style>
</head>
<body>
 <h1>Propreneur Portfolio Summary</h1>
 <p>Generated: {{ $generated_at }}</p>

 <div class="summary">
 <strong>{{ $property_count }} Properties</strong> |
 Monthly Rent Roll: £{{ number_format($total_monthly_rent, 2) }} |
 Collected This Month: £{{ number_format($collected_this_month, 2) }}
 </div>

 <h2>Properties</h2>
 <table>
 <tr>
 <th>Address</th>
 <th>Tenant</th>
 <th>Rent</th>
 <th>Compliance</th>
 </tr>
 @foreach($properties as $property)
 <tr>
 <td>{{ $property->address_line_1 }}</td>
 <td>{{ $property->tenants->where('is_active', true)->first()?->name ?? 'Vacant' }}</td>
 <td>£{{ number_format($property->tenants->where('is_active', true)->first()?->monthly_rent ?? 0, 2) }}</td>
 <td>
 @foreach($property->complianceRecords as $c)
 {{ $c->type }}: {{ $c->expiry_date?->toDateString() ?? 'No date' }}
 @if($c->expiry_date && $c->expiry_date->isPast())
 <span class="danger">EXPIRED</span>
 @elseif($c->expiry_date && $c->expiry_date->diffInDays(now()) <= 30)
 <span class="warning">Due soon</span>
 @endif
 <br>
 @endforeach
 </td>
 </tr>
 @endforeach
 </table>
</body>
</html>
```

## Part 3: Registration

### Dispatcher additions:

```php
use App\Services\Carina\ToolHandlers\BatchOpsHandler;

BatchOpsHandler $batchOps,
$batchOps,
```

### Prompt library:

```php
'batch_operations' => <<<'PROMPT'
You handle batch operations, calendar tracking, and report generation.

-- BATCH RENT --
Use batch_mark_rent to record rent across multiple properties at once:
- month: YYYY-MM (default current month)
- property_ids: (optional) Comma-separated IDs. Omit for all active tenancies.
- amount: (optional) Override rent amount. Uses tenant's monthly_rent if omitted.

-- BATCH COMPLIANCE --
Use batch_compliance_check:
- days: Days to look ahead (default 30)

Returns everything expiring and already expired, grouped by property.

-- CALENDAR --
Use upcoming_events (no params). Returns:
- This week's events
- This month's events
- Compliance deadlines and tenancy renewals

-- REPORTS --
Use generate_report:
- report_type: "summary" (default), "compliance", "financial"
- send_to: (optional) Email address. Defaults to your email.
- property_ids: (optional) Specific properties.

-- PORTFOLIO HEALTH --
Use portfolio_health for a single health score and issues list.
PROMPT,
```

## Part 4: Verification

- [ ] `php -l` passes on BatchOpsHandler
- [ ] `batch_mark_rent` records all active tenancies for month
- [ ] `batch_mark_rent` skips already-paid properties
- [ ] `batch_compliance_check` returns expired and expiring
- [ ] `upcoming_events` shows compliance + tenancy dates sorted
- [ ] `generate_report` creates PDF and emails it
- [ ] `portfolio_health` returns score with issues
- [ ] dompdf installed and configured
- [ ] Report blade template renders without errors
- [ ] No hardcoded values

## Files Summary

| File | Action |
|------|--------|
| `app/Services/Carina/ToolHandlers/BatchOpsHandler.php` | CREATE |
| `resources/views/reports/portfolio-summary.blade.php` | CREATE |
| `app/Services/Carina/CarinaModuleToolDispatcher.php` | MODIFY |
| `brain/prompts/carina_extended/carina-assistant-prompts.php` | MODIFY |
