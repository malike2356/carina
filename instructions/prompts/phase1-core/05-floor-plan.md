# Phase 1.5; Floor Plan Analysis Verification

## Task
Verify and fix the floor plan analysis feature. Adam uploads a floor plan image. Carina reads dimensions via vision AI, generates a Bill of Quantities, and flags HMO compliance issues.

## Files involved
- app/Services/FloorPlan/FloorPlanAnalysisService.php
- app/Services/FloorPlan/BoqCalculationService.php
- app/Services/FloorPlan/FloorPlanComplianceAdvisor.php
- app/Services/FloorPlan/BoqComparisonService.php
- app/Jobs/AnalyseFloorPlan.php
- app/Http/Controllers/Api/FloorPlanController.php
- app/Services/Carina/ToolHandlers/FloorPlanToolHandler.php
- app/Models/Tenant/FloorPlan.php
- app/Models/Tenant/BoqReport.php

## What to verify

1. FloorPlanAnalysisService analyses floor plans
   - Reads image from storage, base64-encodes
   - Loads floor_plan_dimension_extractor prompt from carina-assistant-prompts.php
   - Calls AI vision model via AiRouterService
   - Parses JSON response: property_type, rooms[], overall_dimensions, structural_notes
   - Updates FloorPlan record: status='completed', extracted_rooms, analysed_at
   - On failure: sets status='failed' with error_message

2. BoqCalculationService generates cost estimates
   - Accepts refurb_type: light_refresh, full_refurb, hmo_conversion, commercial_conversion
   - Loads boq_calculation_engine prompt with rooms_json and refurb_type substituted
   - Parses JSON: rooms[].works[], property_summary with grand_total, contingency
   - Creates BoqReport record
   - Uses UK 2025 cost benchmarks: painter £180/day, electrician £250/day, etc.

3. FloorPlanComplianceAdvisor flags issues
   - Checks room sizes against HMO minimums (6.51 sqm single, 10.22 sqm double)
   - Flags fire door requirements, escape routes, ceiling heights
   - Returns severity: ERROR (legally non-compliant), WARNING, INFO
   - Returns compliance_score: GREEN, AMBER, RED

4. FloorPlanController endpoints work
   - POST upload: validates image (jpeg/jpg/png/pdf, max 20MB), stores file, creates FloorPlan, dispatches job
   - GET {id}: returns FloorPlan with boqReports loaded
   - POST {id}/generate-boq: validates refurb_type, calls BoqCalculationService + ComplianceAdvisor
   - POST compare: compares two BoqReport IDs

5. FloorPlanToolHandler registers tools
   - analyze_floor_plan: reads FloorPlan by ID, returns analysis
   - generate_boq: validates refurb_type, calls calculation + compliance
   - compare_refurb_scenarios: compares two BoqReport IDs

## Dependencies
- FloorPlan and BoqReport models must exist (from migration 01)
- AiRouterService must support vision models (Claude 3.5 Sonnet or equivalent)
- Prompts must exist: floor_plan_dimension_extractor, boq_calculation_engine, compliance_advisory_layer, boq_comparator
- Storage disk must be configured for floor plan uploads

## Expected output
- Upload a floor plan image via API
- Carina analyses it within seconds (queued job)
- Analysis returns room dimensions, structural notes
- BOQ generation returns detailed cost breakdown
- Compliance advisor flags HMO issues
- All results visible in admin dashboard

## Verification
```bash
# Upload a sample floor plan
curl -X POST http://localhost/api/floor-plans/upload \
  -F "image=@sample_floorplan.png" \
  -F "property_id=1"

# Check job status, then:
curl http://localhost/api/floor-plans/1

# Generate BOQ
curl -X POST http://localhost/api/floor-plans/1/generate-boq \
  -H "Content-Type: application/json" \
  -d '{"refurb_type": "hmo_conversion"}'
```
