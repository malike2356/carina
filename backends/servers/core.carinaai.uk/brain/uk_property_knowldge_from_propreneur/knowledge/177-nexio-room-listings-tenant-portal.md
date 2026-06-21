# Nexio - Room Listings + Tenant Portal (Phase 6)

## Part A: Internal room listings

- Table: `room_listings` (room, property, title, description, rent, photos JSON, status draft/active/filled/archived)
- Routes: `/listings/rooms` - `RoomListingController`
- Occupancy sync: `RoomService::updateRoom()` → `RoomListingService::syncListingWhenRoomOccupied()` sets `filled`
- Carina: `POST /listings/rooms/generate-description` (JSON `room_id`) for listing copy
- Enquiries: `room_listing_enquiries` + housemate profiles from other active tenancies on the property

## Part B: Tenant portal

- No workspace user - session key `portal_tenancy_id`
- Signed invite: `tenant.portal.accept` → email verify → `tenant.portal.home`
- Pages: tenancy summary, documents (tenancy-scoped only), property/room compliance certs, maintenance requests, legal notices
- Landlord generates link from tenant dossier (`tenancies.portal-invite`)

## Housemate profiles

On `property_tenancies`: `lifestyle_notes`, `smoker`, `pet_friendly`, `work_hours` (editable in dossier profile section).

## Config

`config/tenant_portal.php` - `TENANT_PORTAL_INVITE_TTL_HOURS` (default 72).

## Tests

- `tests/Feature/Listings/RoomListingTest.php`
- `tests/Feature/Portal/TenantPortalAccessTest.php`
