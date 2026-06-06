# Property Assets & Maintenance

**Last updated:** 2026-05-17

## Overview
A property asset register with maintenance management. Track installed assets (boilers, roofs, appliances, electrics) with maintenance schedules, service records, and a document vault. Handle ad-hoc maintenance requests from tenants or staff.

## Core Features
- **Asset register** - Log all property assets with auto-numbering (PA-0001 format), manufacturer details, install/purchase dates, warranty info, and insurance
- **Maintenance schedules** - Set recurring maintenance tasks per asset with frequency, due dates, and assignment
- **Maintenance records** - Log completed maintenance with costs and technician details
- **Maintenance requests** - Ad-hoc requests from tenants or staff with priority levels
- **Property documents** - Document vault for certificates, legal docs, insurance, surveys, plans, contracts
- **Asset lifecycle** - Track assets from active through maintenance to retired/disposed

## Getting Started
1. Add assets for each property - boiler, roof, electrics, HVAC, windows, appliances
2. Set up recurring maintenance schedules (annual gas safety, quarterly checks)
3. Log maintenance work as it's completed
4. Respond to maintenance requests as they come in
5. Store property documents in the vault

## Key Workflows

### Adding an asset
Create an asset with name, category (boiler, roof, electrics, HVAC, windows, appliance, security, plumbing, other), and technical details (manufacturer, model, serial number). Set install date, purchase cost, warranty expiry, and insurance. Assets are auto-numbered.

### Maintenance scheduling
For each asset, create maintenance schedules with task names, frequency in days, and assignments. The system tracks when maintenance is due and flags overdue items. Log each completed maintenance event with cost and notes.

### Handling maintenance requests
Tenants or staff submit requests with priority (low, medium, high, emergency). Requests move through: open, acknowledged, in-progress, completed, or cancelled. Emergency requests trigger immediate notifications. Link requests to specific assets.

### Document vault
Upload property-related documents organised by category (certificate, legal, insurance, survey, plan, contract, other). Track file type, uploader, and optional expiry dates (useful for certificates).

## Business Rules
- Assets auto-numbered as PA-XXXX on creation
- Maintenance schedules check for overdue based on next_due_at date
- Total maintenance cost is aggregated from all maintenance records
- Documents can have expiry dates (e.g., certificates)
- Emergency maintenance requests trigger notifications
- Asset lifecycle: active → under_maintenance → retired/disposed

## Best Practices
- Add every major asset at purchase time - don't backfill later
- Set maintenance frequencies based on manufacturer recommendations
- Link works orders to assets for complete maintenance history
- Store all certificates and warranties in the document vault
- Review the maintenance schedule weekly for upcoming due items
- Run annual asset condition reviews

## Related Features
- **Compliance** - Compliance items link to property certificates and safety checks
- **Works Orders** - Detailed works management for maintenance tasks
- **Refurbishment** - Post-refurb, new assets go into the asset register
