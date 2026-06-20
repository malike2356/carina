# Nexio Room Model -- Phase 1

## What This Is

The Room model is the data spine for all HMO-specific features in Propreneur Nexio. Every HMO-mode feature (compliance engine, shared bills, per-room tenancies, Section 8 toolkit, Carina HMO context) connects to a Room record.

HMO = House in Multiple Occupation. A property with 3+ tenants forming 2+ households, each renting a separate room under separate tenancy agreements.

---

## Database Table: `rooms`

Tenant-scoped table (lives in each tenant's PostgreSQL database).

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | auto-increment |
| `property_id` | FK → properties | cascade delete |
| `created_by` | FK → users | restrict delete |
| `name` | varchar(60) | unique per property (validated in service) |
| `floor` | tinyint unsigned | nullable; 0 = ground floor |
| `room_type` | varchar(30) | default `single`; enum: single, double, ensuite, studio, bedsit |
| `status` | varchar(30) | default `available`; enum: available, occupied, void, maintenance |
| `rent_pcm` | decimal(10,2) | nullable; target monthly rent for this room |
| `deposit_held` | decimal(10,2) | nullable; deposit held for current occupant |
| `sqft` | smallint unsigned | nullable; room size in square feet |
| `ensuite` | boolean | default false |
| `furnished` | boolean | default true |
| `hmo_room_number` | varchar(20) | nullable; licence reference (e.g. R1, R2) |
| `notes` | text | nullable; internal notes |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |
| `deleted_at` | timestamp | soft deletes; null = active |

Indexes: `property_id`, `status`, composite `(property_id, status)`.

---

## Related Table Changes

The Phase 1 migration also adds a nullable `room_id` FK to three existing tables:

| Table | Purpose |
|---|---|
| `property_tenancies` | Links a tenancy to the room it occupies |
| `compliance_items` | Scopes a compliance obligation to a specific room |
| `property_maintenance_requests` | Scopes a maintenance job to a specific room |

All three use `nullOnDelete()` -- deleting a room nulls the FK on related records, preserving history.

BTL tenancies have no room (`room_id = null`). HMO tenancies set `room_id` to link the occupant to a physical room.

---

## Model: `App\Models\Tenant\Room`

**Location:** `app/Models/Tenant/Room.php`

**Key traits:** `SoftDeletes`

**Connection:** `tenant` (required for stancl/tenancy per-tenant DB routing)

### Constants

```php
Room::TYPES    // ['single'=>'Single','double'=>'Double','ensuite'=>'En-suite','studio'=>'Studio','bedsit'=>'Bedsit']
Room::STATUSES // ['available'=>'Available','occupied'=>'Occupied','void'=>'Void','maintenance'=>'Maintenance']
```

### Relationships

| Method | Returns | Notes |
|---|---|---|
| `property()` | `BelongsTo<Property>` | Parent HMO property |
| `creator()` | `BelongsTo<User>` | User who created the record |
| `tenancies()` | `HasMany<PropertyTenancy>` | All tenancies (including ended) for this room |
| `activeTenancy()` | `?PropertyTenancy` | First tenancy where `end_date` is null |
| `complianceItems()` | `HasMany<ComplianceItem>` | Room-scoped compliance obligations |
| `maintenanceRequests()` | `HasMany<PropertyMaintenanceRequest>` | Room-scoped maintenance jobs |

### Helper Methods

- `isOccupied(): bool` -- true when `status === 'occupied'`
- `statusLabel(): string` -- human label from `STATUSES` constant (falls back to ucfirst)
- `typeLabel(): string` -- human label from `TYPES` constant (falls back to ucfirst)

---

## Model Changes: `Property`

**Added:**

```php
public function rooms(): HasMany
{
    return $this->hasMany(Room::class)->orderByRaw("floor ASC NULLS LAST, name ASC");
}

public function isHmo(): bool
{
    return $this->strategy === 'hmo' || $this->property_type === 'hmo';
}
```

`isHmo()` checks both `strategy` and `property_type` because some legacy records set only one of these fields.

---

## Service: `App\Services\Properties\RoomService`

All room business logic. Controller calls service; service calls model.

### `createRoom(Property $property, array $data, int $createdBy): Room`

1. Calls `validateUniqueName()` -- throws `ValidationException` if name already exists on the property.
2. Creates room with `property_id`, `created_by`, and all fillable fields from `$data`.

### `updateRoom(Room $room, array $data): Room`

1. Calls `validateUniqueName()` skipping the current room ID.
2. Updates and returns the room.

### `deleteRoom(Room $room): void`

1. Sets `room_id = null` on all linked `PropertyTenancy`, `ComplianceItem`, and `PropertyMaintenanceRequest` records.
2. Calls `$room->delete()` (soft delete).

Detaching first prevents orphan FK references on `deleted_at` records.

### `roomPl(Room $room): array`

Returns a summary array for the per-room P&L view:

| Key | Type | Source |
|---|---|---|
| `rent_pcm` | `?float` | `$room->rent_pcm` |
| `active_tenancy` | `?PropertyTenancy` | `$room->activeTenancy()` |
| `total_rent_collected` | `float` | Sum of `amount` from `rent_payments` scoped to this room's tenancies |
| `payment_count` | `int` | Count of those payments |
| `open_maintenance` | `int` | Count of open/in-progress maintenance requests for this room |
| `void_since` | `?string` | End date of the most recent ended tenancy (if room is not occupied) |

Phase 1 only. Full journal-entry-linked P&L (shared bills, mortgage allocation, maintenance costs) is Phase 2.

### `propertySummary(Property $property): array`

Aggregate stats for the rooms panel header:

| Key | Description |
|---|---|
| `total` | Total rooms (not soft-deleted) |
| `occupied` | Rooms with status `occupied` |
| `available` | Rooms with status `available` |
| `void` | Rooms with status `void` |
| `maintenance` | Rooms with status `maintenance` |
| `occupancy_rate` | `(occupied / total) * 100`, rounded, as int |
| `total_rent_roll` | Sum of `rent_pcm` across all rooms |
| `occupied_rent_roll` | Sum of `rent_pcm` across occupied rooms only |

### `validateUniqueName(Property $property, string $name, ?int $exceptId = null): void`

Queries `rooms` scoped to `property_id` where `name = $name` (case-insensitive via `ilike`). If a match exists (excluding `$exceptId` if provided), throws `ValidationException` with key `name`.

---

## Controller: `App\Http\Controllers\Tenant\PropertyRoomController`

Thin controller -- each action delegates to `RoomService`.

| Method | Route | Action |
|---|---|---|
| `store` | `POST /properties/{property}/rooms` | Validate, call `createRoom()`, redirect back |
| `update` | `PUT /properties/{property}/rooms/{room}` | Ownership check, validate, call `updateRoom()`, redirect back |
| `destroy` | `DELETE /properties/{property}/rooms/{room}` | Ownership check, call `deleteRoom()`, redirect back |
| `pl` | `GET /properties/{property}/rooms/{room}/pl` | Call `roomPl()`, render `tenant.properties.rooms.pl` |

**Ownership check** (`update` and `destroy`): `abort_unless((int) $room->property_id === (int) $property->id, 404)` -- prevents accessing rooms belonging to another property via URL manipulation.

**Validation rules (store and update):**

| Field | Rules |
|---|---|
| `name` | required, string, max:60 |
| `room_type` | required, string, in:`array_keys(Room::TYPES)` |
| `status` | required, string, in:`array_keys(Room::STATUSES)` |
| `rent_pcm` | nullable, numeric, min:0 |
| `floor` | nullable, integer, min:0, max:20 |
| `hmo_room_number` | nullable, string, max:20 |
| `ensuite` | boolean (checkbox -- present = true) |
| `furnished` | boolean (checkbox -- present = true) |

---

## Routes

Registered in `routes/tenant.php` inside the `properties` prefix group:

```
tenant.properties.rooms.store    POST   /properties/{property}/rooms
tenant.properties.rooms.update   PUT    /properties/{property}/rooms/{room}
tenant.properties.rooms.destroy  DELETE /properties/{property}/rooms/{room}
tenant.properties.rooms.pl       GET    /properties/{property}/rooms/{room}/pl
```

`{property}` and `{room}` are constrained to numeric IDs via `whereNumber()`.

---

## Views

### `resources/views/tenant/properties/partials/rooms-panel.blade.php`

Included in the property show page for HMO properties only. Alpine.js component (`x-data="{ addOpen: false, editRoom: null }"`).

Sections:
1. **Header** -- "Rooms" heading, occupancy stats (x/total occupied, occupancy %, potential rent roll), "+ Add room" button.
2. **Add form** (collapsible, `x-show="addOpen"`) -- name, room_type, status, rent_pcm, floor, hmo_room_number, ensuite checkbox, furnished checkbox.
3. **Room list** -- one `<li>` per room. Each row shows: name, status badge (colour-coded), type label, ensuite flag, rent/mo, active tenancy name, HMO licence ref. Actions: P&L link, Edit button, Remove form (with `onsubmit` confirm).
4. **Inline edit form** per row (`x-show="editing"`) -- same fields as add form, pre-populated.
5. **Occupancy summary bar** at bottom -- potential rent roll, occupied income, void room count.

### `resources/views/tenant/properties/rooms/pl.blade.php`

Per-room P&L view. Route: `tenant.properties.rooms.pl`.

Sections:
1. **Room header card** -- type, ensuite flag, floor, status badge.
2. **4-stat grid** -- target rent/mo, total rent collected (+ payment count), open maintenance requests, tenant since / void since / never let.
3. **Active tenancy card** (if occupied) -- tenant name, rent amount, start date, deposit, Dossier link.
4. **Phase 1 notice** -- "Full per-room P&L with journal entry linkage is coming in a later release."

---

## Property Show Integration

`PropertyController::show()` now:
1. Calls `$property->isHmo()`.
2. If HMO: loads `$property->rooms` (eager), calls `$this->roomService->propertySummary($property)`.
3. Passes `rooms`, `roomSummary`, `roomTypes` (`Room::TYPES`), `roomStatuses` (`Room::STATUSES`) to the view.
4. `show.blade.php` includes `rooms-panel` partial inside `@if ($property->isHmo())`.

Non-HMO properties are unaffected.

---

## Feature Tests

**File:** `tests/Feature/Properties/RoomCrudTest.php`

| Test | Assertion |
|---|---|
| can add a room to an HMO property | Room record exists in tenant DB after POST |
| can update a room | `status` and `rent_pcm` updated after PUT |
| rejects a duplicate room name on the same property | `assertSessionHasErrors('name')` |
| can soft-delete a room | `Room::query()->find($id)` returns null; `Room::withTrashed()->find($id)` returns record |
| returns the per-room pl view | GET `/rooms/{id}/pl` returns 200 and view `tenant.properties.rooms.pl` |

---

## Nexio Phase Roadmap

| Phase | Scope | Status |
|---|---|---|
| 1 (this doc) | Room model, CRUD, per-room P&L (rent payments only) | **Shipped** |
| 2 | HMO compliance engine, fire safety logs, Awaab's Law SLA | **Shipped** (`157-nexio-hmo-compliance-engine.md`, `158-nexio-fire-safety-and-awaabs-law.md`) |
| 3 | Shared bills allocation, Section 8 / Ground 1A / Section 13 legal toolkit | **Shipped** (`160-nexio-shared-bills-engine.md`, `161-nexio-legal-toolkit-notices.md`) |
| 4 | Nexio personas.php config, Carina HMO training corpus, Nexio pricing tier | Persona config shipped (`162-nexio-persona-config.md`); Carina corpus + pricing tier pending |

---

## User-Facing Terminology

Propreneur Nexio is the HMO-mode product. The Room model underpins all Nexio-specific UI. Non-HMO tenants (using Propreneur Let, Pulse, etc.) do not see rooms at all -- the rooms panel is gated by `$property->isHmo()`.
