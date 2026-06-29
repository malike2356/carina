# Sprint: Carina Deal Analysis and Floor Plan via Chat

> Shared preflight: read `README.md` in this folder before implementing. Target `/opt/lampp/htdocs/verlox/propreneur/propreneur-v2`. Verify existing Laravel models, migrations, dispatcher, prompt registry, tenant boundaries, and tests before using any code snippet. Treat snippets as implementation sketches, not blind copy/paste.

## What This Builds

Carina runs deal analysis and floor plan processing entirely via conversation. The user describes a deal and gets instant numbers. The user uploads a floor plan and gets a BOQ estimate. No dashboard. No calculators. Just talk.

## Prerequisites

- Propreneur v2 running at `/opt/lampp/htdocs/verlox/propreneur/propreneur-v2`
- `sprint-carina-document-upload.md`, `sprint-carina-tenant-communication.md`, and `sprint-carina-property-operations.md` must be complete
- DealCalculator service, FloorPlan model, BoqCalculationService already exist (verify before building)

## Architecture

```
User: "Analyze this deal: 3-bed semi in Bristol, 200K purchase, 1,200 rent, 4.5% mortgage"
 -> Carina calls analyze_deal
 -> Returns: monthly cash flow, ROI, yield, LTV, deal rating

User: [uploads floor plan image] "What's the refurb cost for a light refresh?"
 -> Carina calls analyze_floor_plan
 -> Returns: BOQ estimate, room breakdown, compliance flags
```

## Part 1: Deal Analysis Tool

Add to a new handler or extend PropertyOpsHandler. Create `app/Services/Carina/ToolHandlers/DealAnalysisHandler.php`:

```php
<?php

declare(strict_types=1);

namespace App\Services\Carina\ToolHandlers;

use App\Models\Tenant\User;
use App\Services\Carina\CarinaConversation;
use App\Services\Carina\ToolResult;

final class DealAnalysisHandler extends AbstractModuleToolHandler
{
  protected array $tools = [
    'analyze_deal',
    'analyze_floor_plan',
    'compare_deals',
  ];

  public function __construct() {}

  public function handle(string $name, array $args, ?User $user, CarinaConversation $conversation): ToolResult
  {
    try {
      return match ($name) {
        'analyze_deal' => $this->analyzeDeal($args),
        'analyze_floor_plan' => $this->analyzeFloorPlan($args),
        'compare_deals' => $this->compareDeals($args),
        default => $this->fail('Unsupported tool.'),
      };
    } catch (\Throwable $e) {
      return $this->fail($e->getMessage(), 'execution_error');
    }
  }

  /**
  * Analyze a property deal from conversation input.
  * User describes the deal in natural language, Carina extracts the numbers and runs them.
  */
  private function analyzeDeal(array $args): ToolResult
  {
    $purchasePrice = (float) ($args['purchase_price'] ?? 0);
    $monthlyRent = (float) ($args['monthly_rent'] ?? 0);
    $depositPercent = (float) ($args['deposit_percent'] ?? 25);
    $interestRate = (float) ($args['interest_rate'] ?? 5.0);
    $mortgageTerm = (int) ($args['mortgage_term'] ?? 25);
    $propertyType = $args['property_type'] ?? 'single_let';
    $bedrooms = (int) ($args['bedrooms'] ?? 3);
    $location = $args['location'] ?? null;

    if ($purchasePrice <= 0 || $monthlyRent <= 0) {
      return $this->fail('Purchase price and monthly rent are required.');
    }

    // Calculate deposit
    $deposit = $purchasePrice * ($depositPercent / 100);
    $mortgageAmount = $purchasePrice - $deposit;

    // Monthly mortgage payment (simplified interest-only for rental)
    $monthlyInterest = ($mortgageAmount * ($interestRate / 100)) / 12;
    $monthlyCapitalRepayment = $mortgageAmount / ($mortgageTerm * 12);
    $monthlyMortgage = $monthlyInterest + $monthlyCapitalRepayment;

    // Running costs (estimated)
    $managementFee = $monthlyRent * 0.10; // 10% letting agent
    $maintenance = $monthlyRent * 0.10; // 10% maintenance provision
    $insurance = 50; // rough monthly
    $voidProvision = $monthlyRent * 0.05; // 5% void period
    $totalCosts = $managementFee + $maintenance + $insurance + $voidProvision;

    // Cash flow
    $monthlyCashFlow = $monthlyRent - $monthlyMortgage - $totalCosts;
    $annualCashFlow = $monthlyCashFlow * 12;

    // ROI
    $totalInvestment = $deposit + ($purchasePrice * 0.03); // deposit + ~3% costs (stamp duty, legal)
    $roi = $totalInvestment > 0 ? ($annualCashFlow / $totalInvestment) * 100 : 0;

    // Gross yield
    $grossYield = $purchasePrice > 0 ? ($monthlyRent * 12 / $purchasePrice) * 100 : 0;

    // LTV
    $ltv = $purchasePrice > 0 ? ($mortgageAmount / $purchasePrice) * 100 : 0;

    // Deal rating
    $rating = $this->rateDeal($monthlyCashFlow, $roi, $grossYield, $ltv);

    // HMO warning
    $hmoWarning = null;
    if ($bedrooms >= 5 && $propertyType !== 'hmo') {
      $hmoWarning = 'This property has 5+ bedrooms. Check if mandatory HMO licensing applies.';
    }

    return $this->success([
        'deal_summary' => [
          'purchase_price' => round($purchasePrice, 2),
          'monthly_rent' => round($monthlyRent, 2),
          'deposit' => round($deposit, 2),
          'mortgage_amount' => round($mortgageAmount, 2),
          'interest_rate' => $interestRate,
          'location' => $location,
        ],
        'monthly_breakdown' => [
          'gross_rent' => round($monthlyRent, 2),
          'mortgage_payment' => round($monthlyMortgage, 2),
          'management_fee' => round($managementFee, 2),
          'maintenance' => round($maintenance, 2),
          'insurance' => round($insurance, 2),
          'void_provision' => round($voidProvision, 2),
          'total_costs' => round($totalCosts, 2),
          'net_cash_flow' => round($monthlyCashFlow, 2),
        ],
        'returns' => [
          'monthly_cash_flow' => round($monthlyCashFlow, 2),
          'annual_cash_flow' => round($annualCashFlow, 2),
          'roi_percent' => round($roi, 1),
          'gross_yield_percent' => round($grossYield, 1),
          'total_investment' => round($totalInvestment, 2),
          'ltv_percent' => round($ltv, 1),
        ],
        'rating' => $rating,
        'hmo_warning' => $hmoWarning,
        'formatted' => "Deal: £{$purchasePrice} purchase, £{$monthlyRent}/mo rent. Monthly cash flow: £" . number_format($monthlyCashFlow, 2) . ". ROI: {$roi}%. Gross yield: {$grossYield}%. Rating: {$rating['label']}.",
    ]);
  }

  /**
  * Analyze a floor plan from an uploaded file.
  * Triggers the existing FloorPlan analysis pipeline via chat.
  */
  private function analyzeFloorPlan(array $args): ToolResult
  {
    $filePath = $args['file_path'] ?? null;
    $fileName = $args['file_name'] ?? 'floor-plan';
    $refurbType = $args['refurb_type'] ?? 'light_refresh';
    $propertyRef = $args['property_reference'] ?? null;

    if (!$filePath) {
      return $this->fail('Floor plan file is required. Upload the image first, then ask me to analyze it.');
    }

    $validTypes = ['light_refresh', 'full_refurb', 'hmo_conversion', 'commercial_conversion'];
    if (!in_array($refurbType, $validTypes)) {
      return $this->fail("Invalid refurb type. Choose: " . implode(', ', $validTypes));
    }

    // Resolve property if provided
    $propertyId = null;
    if ($propertyRef) {
      $property = \App\Models\Tenant\Property::where('address_line_1', 'like', "%{$propertyRef}%")->first();
      $propertyId = $property?->id;
    }

    // Create FloorPlan record
    $floorPlan = \App\Models\Tenant\FloorPlan::create([
        'property_id' => $propertyId,
        'original_filename' => $fileName,
        'storage_path' => $filePath,
        'disk' => 'public',
        'status' => 'pending',
    ]);

    // Dispatch analysis job (existing pipeline)
    \App\Jobs\AnalyseFloorPlan::dispatch($floorPlan);

    return $this->success([
        'floor_plan_id' => $floorPlan->id,
        'status' => 'processing',
        'refurb_type' => $refurbType,
        'message' => "Floor plan '{$fileName}' received. Analysis started. I'll tell you when it's complete (usually under 2 minutes).",
        'check_status' => "Ask me 'is floor plan {$floorPlan->id} ready?' to check progress.",
    ]);
  }

  /**
  * Compare two deals side by side.
  */
  private function compareDeals(array $args): ToolResult
  {
    $dealA = $args['deal_a'] ?? null;
    $dealB = $args['deal_b'] ?? null;

    if (!$dealA || !$dealB) {
      return $this->fail('Two deals are required for comparison. Provide deal_a and deal_b with purchase_price and monthly_rent for each.');
    }

    $resultA = $this->analyzeDeal($dealA);
    $resultB = $this->analyzeDeal($dealB);

    if (!$resultA->success || !$resultB->success) {
      return $this->fail('Could not analyze one or both deals.');
    }

    $a = $resultA->data;
    $b = $resultB->data;

    $betterRoi = $a['returns']['roi_percent'] > $b['returns']['roi_percent'] ? 'Deal A' : 'Deal B';
    $betterCashFlow = $a['returns']['monthly_cash_flow'] > $b['returns']['monthly_cash_flow'] ? 'Deal A' : 'Deal B';

    return $this->success([
        'deal_a' => [
          'purchase' => $a['deal_summary']['purchase_price'],
          'rent' => $a['deal_summary']['monthly_rent'],
          'cash_flow' => $a['returns']['monthly_cash_flow'],
          'roi' => $a['returns']['roi_percent'] . '%',
          'rating' => $a['rating']['label'],
        ],
        'deal_b' => [
          'purchase' => $b['deal_summary']['purchase_price'],
          'rent' => $b['deal_summary']['monthly_rent'],
          'cash_flow' => $b['returns']['monthly_cash_flow'],
          'roi' => $b['returns']['roi_percent'] . '%',
          'rating' => $b['rating']['label'],
        ],
        'verdict' => "Better ROI: {$betterRoi}. Better monthly cash flow: {$betterCashFlow}.",
    ]);
  }

  // -- Deal Rating ------------------------------------------

  private function rateDeal(float $monthlyCashFlow, float $roi, float $grossYield, float $ltv): array
  {
    $score = 0;

    if ($monthlyCashFlow > 300) $score += 3;
    elseif ($monthlyCashFlow > 150) $score += 2;
    elseif ($monthlyCashFlow > 0) $score += 1;

    if ($roi > 10) $score += 3;
    elseif ($roi > 7) $score += 2;
    elseif ($roi > 4) $score += 1;

    if ($grossYield > 8) $score += 2;
    elseif ($grossYield > 5) $score += 1;

    if ($ltv <= 75) $score += 1;

    if ($monthlyCashFlow <= 0) $score -= 2;

    return match (true) {
      $score >= 7 => ['label' => 'Excellent', 'score' => $score, 'color' => 'green'],
      $score >= 4 => ['label' => 'Good', 'score' => $score, 'color' => 'amber'],
      $score >= 1 => ['label' => 'Marginal', 'score' => $score, 'color' => 'orange'],
      default => ['label' => 'Avoid', 'score' => $score, 'color' => 'red'],
    };
  }
}
```

## Part 2: Check Floor Plan Status

Add to `DealAnalysisHandler`:

```php
'check_floor_plan_status',

// In handle():
'check_floor_plan_status' => $this->checkFloorPlanStatus($args),

// Method:
private function checkFloorPlanStatus(array $args): ToolResult
{
  $floorPlanId = $args['floor_plan_id'] ?? null;
  if (!$floorPlanId) {
    return $this->fail('Floor plan ID is required.');
  }

  $floorPlan = \App\Models\Tenant\FloorPlan::find($floorPlanId);
  if (!$floorPlan) {
    return $this->fail("Floor plan {$floorPlanId} not found.");
  }

  if ($floorPlan->status === 'completed') {
    // Get the BOQ if available
    $boq = $floorPlan->boqReports()->latest()->first();

    return $this->success([
        'floor_plan_id' => $floorPlan->id,
        'status' => 'completed',
        'rooms' => $floorPlan->extracted_rooms,
        'dimensions' => $floorPlan->overall_dimensions,
        'structural_notes' => $floorPlan->structural_notes,
        'boq' => $boq ? [
          'refurb_type' => $boq->refurb_type,
          'grand_total' => $boq->grand_total,
          'compliance_flags' => $boq->compliance_flags,
        ] : null,
        'message' => $boq
        ? "Floor plan analyzed. BOQ estimate: £" . number_format($boq->grand_total, 2) . " for {$boq->refurb_type}."
        : "Floor plan analyzed. No BOQ generated yet. Ask me to generate a BOQ estimate.",
    ]);
  }

  if ($floorPlan->status === 'failed') {
    return $this->success([
        'floor_plan_id' => $floorPlan->id,
        'status' => 'failed',
        'error' => $floorPlan->error_message,
        'message' => "Floor plan analysis failed: {$floorPlan->error_message}. Try uploading a clearer image.",
    ]);
  }

  return $this->success([
      'floor_plan_id' => $floorPlan->id,
      'status' => $floorPlan->status,
      'message' => "Floor plan is still {$floorPlan->status}. I'll update you when it's ready.",
  ]);
}
```

Also add to `$tools` array:
```php
'check_floor_plan_status',
```

## Part 3: Registration

### 3.1 Register in Dispatcher

In `app/Services/Carina/CarinaModuleToolDispatcher.php`:

```php
use App\Services\Carina\ToolHandlers\DealAnalysisHandler;

// Constructor:
DealAnalysisHandler $dealAnalysis,

// Handlers array:
$dealAnalysis,
```

### 3.2 Prompt Library Addition

```php
'deal_analysis' => <<<'PROMPT'
You analyze property deals and floor plans via conversation.

-- DEAL ANALYSIS --
Use analyze_deal when the user describes a property deal:
- purchase_price: Purchase price in pounds (REQUIRED)
- monthly_rent: Expected monthly rent (REQUIRED)
- deposit_percent: Deposit percentage (default 25)
- interest_rate: Mortgage interest rate (default 5.0)
- mortgage_term: Years (default 25)
- property_type: single_let, hmo, multi_unit, commercial
- bedrooms: Number of bedrooms
- location: City or area name

You calculate: monthly cash flow, ROI, gross yield, LTV, and give a deal rating (Excellent/Good/Marginal/Avoid).

Example:
User: "Analyze this deal: 200K 3-bed in Bristol, 1,200/month rent, 4.5% mortgage"
You call: analyze_deal(purchase_price=200000, monthly_rent=1200, interest_rate=4.5, bedrooms=3, location="Bristol")

Present the results clearly:
- Cash flow per month
- ROI percentage
- Gross yield
- Rating with color

-- FLOOR PLAN ANALYSIS --
Use analyze_floor_plan when the user uploads a floor plan:
- file_path: Path to the uploaded file (REQUIRED)
- file_name: Original filename (REQUIRED)
- refurb_type: light_refresh, full_refurb, hmo_conversion, commercial_conversion
- property_reference: (optional) Link to existing property

After analysis starts, tell the user: "Analysis started. I'll update you when it's ready."

Use check_floor_plan_status to check progress:
- floor_plan_id: ID from analyze_floor_plan response

-- DEAL COMPARISON --
Use compare_deals to compare two deals:
- deal_a: {purchase_price, monthly_rent, ...}
- deal_b: {purchase_price, monthly_rent, ...}

-- KEY NUMBERS TO KNOW --
- Good cash flow: >£150/month per property
- Good ROI: >7%
- Good gross yield: >5%
- Healthy LTV: 75% or below
- HMO licensing: mandatory for 5+ tenants from 3+ households (England)

Always flag if 5+ bedrooms triggers potential HMO licensing.
PROMPT,
```

## Part 4: Verification

- [ ] `php -l` passes on DealAnalysisHandler
- [ ] Handler registered in dispatcher (import + param + array)
- [ ] `analyze_deal` calculates correctly with default and custom values
- [ ] Deal rating returns correct label for different scenarios
- [ ] `analyze_floor_plan` creates FloorPlan record and dispatches job
- [ ] `check_floor_plan_status` returns status and BOQ when complete
- [ ] `compare_deals` compares two deals and picks winner
- [ ] HMO warning triggers for 5+ bedrooms
- [ ] All monetary values rounded to 2 decimal places
- [ ] No hardcoded names or values
- [ ] 644 permissions after deploy

## Files Summary

| File | Action |
|------|--------|
| `app/Services/Carina/ToolHandlers/DealAnalysisHandler.php` | CREATE |
| `app/Services/Carina/CarinaModuleToolDispatcher.php` | MODIFY |
| `brain/prompts/carina_extended/carina-assistant-prompts.php` | MODIFY |
