# Works Orders

**Last updated:** 2026-05-17

## Overview
Manage work orders for property maintenance and improvement tasks. Track orders from creation through quotes, approvals, and completion. Link to specific properties, assets, and maintenance requests for a complete work history.

## Core Features
- **Work order management** - Create orders for property trades (plumbing, electrical, carpentry, general)
- **Quote management** - Receive and compare multiple quotes per works order, accept the best one
- **Status tracking** - Full lifecycle from draft through to completion and invoicing
- **Priority levels** - Low, medium, high, emergency
- **Cost tracking** - Estimated vs actual cost comparison
- **Asset linkage** - Link works orders to specific property assets for maintenance history

## Getting Started
1. Create a works order linked to a property (and optionally an asset or maintenance request)
2. Request quotes from contractors
3. Review and accept the best quote
4. Approve the work and schedule it
5. Mark complete when finished, track actual costs

## Key Workflows

### Creating a works order
Enter the property, trade type, title, description, and priority. Optionally link to an asset or maintenance request. Set estimated costs. The order starts as a draft.

### Quote management
Contractors submit quotes with provider name, amount, description, and optional document upload. Multiple quotes can be received per order. Accept the best one - only one quote can be accepted per order.

### Completing work
Work orders move through: draft, quote_requested, quote_received, approved, in_progress, completed, cancelled, or invoiced. Track actual costs against estimates. Mark as complete when work is finished.

## Business Rules
- Status lifecycle: draft → quote_requested → quote_received → approved → in_progress → completed/invoiced
- Multiple quotes per works order; only one can be accepted
- Works orders can be linked to property assets for asset maintenance history
- Priority levels: low, medium, high, emergency
- Estimated vs actual costs tracked for budget management

## Best Practices
- Always get at least 2-3 quotes for significant works
- Link works orders to assets for complete maintenance records
- Set realistic estimated costs based on quotes received
- Use emergency priority sparingly - it should mean truly urgent
- Keep quotes as attachments in the order for future reference

## Related Features
- **Property Assets & Maintenance** - Asset-linked work tracking
- **Refurbishment** - Works orders feed into larger refurbishment projects
- **Accounting & Finance** - Works order costs flow into expense tracking
