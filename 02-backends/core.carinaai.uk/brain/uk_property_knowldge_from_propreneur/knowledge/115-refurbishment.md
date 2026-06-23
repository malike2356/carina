# Refurbishment

**Last updated:** 2026-05-17

## Overview
Manage property renovation projects from planning through completion. Track budgets vs actual costs, itemise work with line items from a catalogue, set milestones with approvals, and estimate refurb costs during deal underwriting.

## Core Features
- **Refurbishment projects** - Create projects linked to properties with budget tracking
- **Line items** - Itemise every job with quantities, unit costs, and status tracking (pending, ordered, in-progress, completed)
- **Catalogue items** - Reusable standard items with default costs (kitchens, bathrooms, flooring, decorating, plumbing, electrical, structural, garden)
- **Milestones** - Key project milestones with optional approval gates
- **Budget vs actual** - Track variance between budget and actual spend
- **Deal-linked refurb lines** - Estimate refurb costs during deal underwriting before committing to a project

## Getting Started
1. Create a refurbishment project linked to a property
2. Add line items from the catalogue or create custom ones
3. Set milestones with target dates and optional approval requirements
4. Track actual costs as work progresses
5. Mark milestones and line items complete as work finishes

## Key Workflows

### Planning a refurbishment
Define your project with a title, property, and budget. Add line items either from the catalogue (standard items with default costs) or as custom items. Each line item has a quantity, unit cost, and status. The total budget is calculated automatically.

### Using the catalogue
The catalogue contains standard refurbishment items organised by category: kitchen, bathroom, flooring, decorating, plumbing, electrical, structural, garden, and other. Each item has a default cost and unit (each, m2, linear m, day, hour). Use catalogue items to standardise cost estimation.

### Tracking costs
As work progresses, update line item costs with actual spend. The variance attribute shows over/under budget position. Milestones track completion of key phases. Some milestones can require approval before work proceeds to the next phase.

### Deal underwriting estimates
Before committing to a project, use deal-linked refurb lines to estimate costs during deal analysis. These lines feed into flip, BRR, and development calculator calculations.

## Business Rules
- Budget vs actual variance is auto-computed
- Line items can be sourced from the catalogue or created custom
- Milestones can require approval (sign-off) before proceeding
- Deal-linked refurb lines are separate from project lines - they feed deal underwriting
- Project status progression: planned, in-progress, completed, on-hold, cancelled
- Projects support soft-delete (recoverable)

## Best Practices
- Build out your catalogue with your frequently used items and costs
- Set realistic budgets and track actuals weekly to catch overruns early
- Use milestone approvals for big-ticket items (kitchen, bathroom, structural)
- Start deal-linked refurb estimates during initial underwriting, then convert to full projects
- Inspect and update line item statuses regularly - it's your single source of truth

## Related Features
- **Deal Calculators** - Refurb estimates feed into flip and BRR calculations
- **Property Assets & Maintenance** - After refurb, assets go into the maintenance register
- **Works Orders** - Individual trade works can be managed through works orders
