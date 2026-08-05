# Sprint: Carina Property Sourcing, Tax, and Portfolio Intelligence

**Status: COMPLETED 2026-07-26**

**What was built:**
- Implemented and archived

> Shared preflight: read `README.md` in this folder before implementing. Target `/opt/lampp/htdocs/verlox/propreneur/propreneur-v2`. Verify existing Laravel models, migrations, dispatcher, prompt registry, tenant boundaries, and tests before using any code snippet. Treat snippets as implementation sketches, not blind copy/paste.

## What This Builds

Three advanced capabilities in one handler:

1. **Property Sourcing CRM**: Track leads, manage deal pipeline stages, record offers
2. **Tax Preparation**: Expense summaries, rental income reports for self-assessment
3. **Portfolio Intelligence**: Cross-property analytics - best/worst performers, capital growth, yield trends

## Part 1: Database

```php
Schema::create('sourcing_leads', function (Blueprint $table) {
    $table->id();
    $table->string('property_address')->nullable();
    $table->string('source'); // agent, auction, online, referral, drive_by
    $table->decimal('asking_price', 12, 2)->nullable();
    $table->decimal('offer_amount', 12, 2)->nullable();
    $table->string('stage')->default('identified'); // identified, viewing_booked, viewed, under_analysis, offer_made, offer_accepted, conveyancing, completed, rejected, archived
    $table->decimal('estimated_monthly_rent', 10, 2)->nullable();
    $table->decimal('estimated_roi', 8, 2)->nullable();
    $table->text('notes')->nullable();
    $table->foreignId('agent_contact_id')->nullable();
    $table->date('next_action_date')->nullable();
    $table->string('next_action')->nullable();
    $table->foreignId('assigned_to_user_id')->nullable()->constrained('users')->nullOnDelete();
    $table->timestamps();
});

Schema::create('property_expenses', function (Blueprint $table) {
    $table->id();
    $table->foreignId('property_id')->constrained()->cascadeOnDelete();
    $table->string('category'); // mortgage_interest, repairs, insurance, management_fee, service_charge, council_tax, utilities, legal, travel, other
    $table->decimal('amount', 10, 2);
    $table->date('expense_date');
    $table->string('description')->nullable();
    $table->string('receipt_path')->nullable();
    $table->boolean('tax_deductible')->default(true);
    $table->foreignId('recorded_by_user_id')->nullable()->constrained('users')->nullOnDelete();
    $table->timestamps();
});
```

## Part 2: Handler

Create `app/Services/Carina/ToolHandlers/AdvancedOpsHandler.php`:

```php
<?php

declare(strict_types=1);

namespace App\Services\Carina\ToolHandlers;

use App\Models\Tenant\Property;
use App\Models\Tenant\PropertyExpense;
use App\Models\Tenant\RentPayment;
use App\Models\Tenant\SourcingLead;
use App\Models\Tenant\Tenant;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaConversation;
use App\Services\Carina\ToolResult;
use Carbon\Carbon;

final class AdvancedOpsHandler extends AbstractModuleToolHandler
{
  protected array $tools = [
    'manage_sourcing_lead',
    'pipeline_overview',
    'record_expense',
    'tax_summary',
    'portfolio_intelligence',
  ];

  public function __construct() {}

  public function handle(string $name, array $args, ?User $user, CarinaConversation $conversation): ToolResult
  {
    try {
      return match ($name) {
        'manage_sourcing_lead' => $this->manageLead($args, $user),
        'pipeline_overview' => $this->pipelineOverview(),
        'record_expense' => $this->recordExpense($args, $user),
        'tax_summary' => $this->taxSummary($args),
        'portfolio_intelligence' => $this->portfolioIntelligence(),
        default => $this->fail('Unsupported tool.'),
      };
    } catch (\Throwable $e) {
      return $this->fail($e->getMessage(), 'execution_error');
    }
  }

  // -- SOURCING CRM -----------------------------------------

  private function manageLead(array $args, ?User $user): ToolResult
  {
    $action = $args['action'] ?? 'add';
    $leadId = $args['lead_id'] ?? null;

    if ($action === 'add') {
      $lead = SourcingLead::create([
          'property_address' => $args['property_address'] ?? null,
          'source' => $args['source'] ?? 'agent',
          'asking_price' => $args['asking_price'] ?? null,
          'estimated_monthly_rent' => $args['estimated_monthly_rent'] ?? null,
          'notes' => $args['notes'] ?? null,
          'stage' => 'identified',
          'assigned_to_user_id' => $user?->id,
      ]);
      return $this->success(['lead_id' => $lead->id, 'message' => "Lead #{$lead->id} added."]);
    }

    if ($action === 'update' && $leadId) {
      $lead = SourcingLead::find($leadId);
      if (!$lead) return $this->fail("Lead #{$leadId} not found.");

      $updates = [];
      foreach (['stage', 'offer_amount', 'notes', 'estimated_monthly_rent', 'next_action', 'next_action_date'] as $f) {
        if (isset($args[$f])) $updates[$f] = $args[$f];
      }

      if (($args['stage'] ?? '') === 'offer_accepted' && $lead->offer_amount && $lead->estimated_monthly_rent) {
        $updates['estimated_roi'] = round(($lead->estimated_monthly_rent * 12 / $lead->offer_amount) * 100, 1);
      }

      $lead->update($updates);

      return $this->success([
          'lead_id' => $lead->id,
          'stage' => $lead->stage,
          'offer' => $lead->offer_amount,
          'estimated_roi' => $lead->estimated_roi,
          'message' => "Lead updated to {$lead->stage}.",
      ]);
    }

    return $this->fail("Use action='add' or action='update' with lead_id.");
  }

  private function pipelineOverview(): ToolResult
  {
    $stages = ['identified', 'viewing_booked', 'viewed', 'under_analysis', 'offer_made', 'offer_accepted', 'conveyancing'];

    $pipeline = [];
    foreach ($stages as $stage) {
      $leads = SourcingLead::where('stage', $stage)->get();
      if ($leads->isNotEmpty()) {
        $pipeline[$stage] = $leads->map(fn($l) => [
            'id' => $l->id,
            'address' => $l->property_address,
            'asking' => $l->asking_price,
            'offer' => $l->offer_amount,
            'roi' => $l->estimated_roi,
            'source' => $l->source,
        ])->toArray();
      }
    }

    $total = SourcingLead::whereNotIn('stage', ['completed', 'rejected', 'archived'])->count();
    $active = SourcingLead::whereIn('stage', ['offer_made', 'offer_accepted', 'conveyancing'])->count();

    return $this->success([
        'total_active' => $total,
        'in_negotiation' => $active,
        'pipeline' => $pipeline,
        'message' => "{$total} active leads. {$active} in negotiation.",
    ]);
  }

  // -- EXPENSES & TAX ---------------------------------------

  private function recordExpense(array $args, ?User $user): ToolResult
  {
    $propertyRef = $args['property_reference'] ?? null;
    $category = $args['category'] ?? 'other';
    $amount = (float) ($args['amount'] ?? 0);
    $date = $args['expense_date'] ?? now()->toDateString();

    if (!$propertyRef || $amount <= 0) return $this->fail('Property reference and amount required.');

    $property = Property::where('address_line_1', 'like', "%{$propertyRef}%")->first();
    if (!$property) return $this->fail("Property not found.");

    $expense = PropertyExpense::create([
        'property_id' => $property->id,
        'category' => $category,
        'amount' => $amount,
        'expense_date' => $date,
        'description' => $args['description'] ?? null,
        'tax_deductible' => $args['tax_deductible'] ?? true,
        'recorded_by_user_id' => $user?->id,
    ]);

    return $this->success([
        'expense_id' => $expense->id,
        'property' => $property->address_line_1,
        'category' => $category,
        'amount' => $amount,
        'message' => "Expense of £{$amount} recorded for {$property->address_line_1}.",
    ]);
  }

  private function taxSummary(array $args): ToolResult
  {
    $taxYear = $args['tax_year'] ?? (now()->month >= 4 ? now()->year . '-' . (now()->year + 1) : (now()->year - 1) . '-' . now()->year);

    // Parse tax year into date range (April 6 - April 5)
    $startYear = explode('-', $taxYear)[0];
    $startDate = "{$startYear}-04-06";
    $endDate = ($startYear + 1) . '-04-05';

    // Income
    $totalRent = RentPayment::whereBetween('payment_date', [$startDate, $endDate])
    ->where('status', 'paid')
    ->sum('amount');

    // Expenses
    $expenses = PropertyExpense::whereBetween('expense_date', [$startDate, $endDate])
    ->where('tax_deductible', true)
    ->get();

    $totalExpenses = $expenses->sum('amount');

    $byCategory = $expenses->groupBy('category')->map(fn($group) => [
        'category' => $group->first()->category,
        'total' => round($group->sum('amount'), 2),
        'count' => $group->count(),
    ])->values();

    $netIncome = $totalRent - $totalExpenses;

    return $this->success([
        'tax_year' => $taxYear,
        'period' => "{$startDate} to {$endDate}",
        'total_rental_income' => round($totalRent, 2),
        'total_expenses' => round($totalExpenses, 2),
        'net_income' => round($netIncome, 2),
        'expenses_by_category' => $byCategory->toArray(),
        'message' => "Tax year {$taxYear}: £" . number_format($totalRent, 2) . " income, £" . number_format($totalExpenses, 2) . " expenses. Net: £" . number_format($netIncome, 2) . ".",
        'note' => 'This is a summary for self-assessment. Consult your accountant before filing.',
    ]);
  }

  // -- PORTFOLIO INTELLIGENCE -------------------------------

  private function portfolioIntelligence(): ToolResult
  {
    $properties = Property::with(['tenants', 'rentPayments', 'expenses'])->get();

    $analysis = [];
    foreach ($properties as $p) {
      $activeTenant = $p->tenants->where('is_active', true)->first();
      $annualRent = $activeTenant ? $activeTenant->monthly_rent * 12 : 0;

      // This year's rent collected
      $fiscalStart = now()->month >= 4 ? now()->startOfYear()->addMonths(3) : now()->subYear()->startOfYear()->addMonths(3);
      $rentCollected = $p->rentPayments->where('payment_date', '>=', $fiscalStart)->where('status', 'paid')->sum('amount');

      // Total expenses this year
      $totalExpenses = $p->expenses->where('expense_date', '>=', $fiscalStart)->sum('amount');

      $grossYield = $p->purchase_price > 0 && $annualRent > 0 ? round(($annualRent / $p->purchase_price) * 100, 1) : null;
      $netCashFlow = $annualRent - $totalExpenses - ($p->mortgage_amount ? ($p->mortgage_amount * ($p->interest_rate ?? 5) / 100) : 0);

      $analysis[] = [
        'property' => $p->address_line_1,
        'purchase_price' => $p->purchase_price,
        'current_value' => $p->current_value,
        'annual_rent' => round($annualRent, 2),
        'gross_yield' => $grossYield,
        'rent_collected_ytd' => round($rentCollected, 2),
        'expenses_ytd' => round($totalExpenses, 2),
        'net_cash_flow' => round($netCashFlow, 2),
        'equity_gain' => $p->purchase_price && $p->current_value ? round($p->current_value - $p->purchase_price, 2) : null,
        'vacant' => !$activeTenant,
      ];
    }

    // Sort by yield descending
    usort($analysis, fn($a, $b) => ($b['gross_yield'] ?? 0) <=> ($a['gross_yield'] ?? 0));

    $best = $analysis[0] ?? null;
    $worst = count($analysis) > 1 ? $analysis[count($analysis) - 1] : null;
    $totalRentRoll = array_sum(array_column($analysis, 'annual_rent'));

    return $this->success([
        'property_count' => count($analysis),
        'total_annual_rent_roll' => round($totalRentRoll, 2),
        'best_performer' => $best,
        'worst_performer' => $worst,
        'all_properties' => $analysis,
        'message' => "Portfolio: " . count($analysis) . " properties. Annual rent roll: £" . number_format($totalRentRoll, 2) . ". Best yield: {$best['property']} ({$best['gross_yield']}%).",
    ]);
  }
}
```

## Part 3: Registration and Prompt

```php
'advanced_ops' => <<<'PROMPT'
You handle property sourcing, expenses, tax summaries, and portfolio analytics.

-- SOURCING CRM --
Use manage_sourcing_lead(action="add") to add new leads. Track stage progression with action="update".
Pipeline stages: identified -> viewing_booked -> viewed -> under_analysis -> offer_made -> offer_accepted -> conveyancing -> completed
Use pipeline_overview for a full pipeline snapshot.

-- EXPENSES --
Use record_expense to log property expenses. Categories: mortgage_interest, repairs, insurance, management_fee, service_charge, council_tax, utilities, legal, travel, other. All are tax_deductible by default.

-- TAX SUMMARY --
Use tax_summary for any tax year. Returns income, expenses by category, and net income. ALWAYS add: "Consult your accountant before filing."

-- PORTFOLIO INTELLIGENCE --
Use portfolio_intelligence for a full analysis: best/worst performing properties, yields, cash flow, equity gains, vacancies. Sort by gross yield descending.

When a property is vacant and performing poorly, proactively suggest: "Flat 2 is vacant and yielding 0%. Would you like me to draft a listing or check when the tenancy ended?"
PROMPT,
```

## Verification

- [ ] Sourcing leads progress through pipeline stages
- [ ] pipeline_overview shows counts per stage
- [ ] Expenses recorded per property with categories
- [ ] tax_summary calculates correct period and net income
- [ ] portfolio_intelligence ranks properties by yield
- [ ] Vacant properties flagged
- [ ] Standard registration and no hardcoded values

## Files Summary

| File | Action |
|------|--------|
| `database/migrations/tenant/XXXX_create_sourcing_expenses_tables.php` | CREATE |
| `app/Models/Tenant/SourcingLead.php` | CREATE |
| `app/Models/Tenant/PropertyExpense.php` | CREATE |
| `app/Services/Carina/ToolHandlers/AdvancedOpsHandler.php` | CREATE |
| `app/Services/Carina/CarinaModuleToolDispatcher.php` | MODIFY |
| `brain/prompts/carina_extended/carina-assistant-prompts.php` | MODIFY |
