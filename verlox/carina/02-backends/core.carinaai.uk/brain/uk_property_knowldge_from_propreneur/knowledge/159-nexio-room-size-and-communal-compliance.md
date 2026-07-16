# Nexio Room Size and Communal Compliance -- Phase 2c

Builds on `157-nexio-hmo-compliance-engine.md` and `158-nexio-fire-safety-and-awaabs-law.md`.

---

## Room size compliance

### `rooms` columns

| Column | Purpose |
|---|---|
| `floor_area_sqm` | Floor area in square metres |
| `occupant_type` | `single`, `double`, `under_10` |
| `size_compliant` | Stored flag: `true`, `false`, or `null` (unknown) |

### Minimum areas (HMO Mandatory Conditions 2018)

Defined on `App\Models\Tenant\Room::SIZE_MINIMUMS`:

| Occupant type | Minimum m² |
|---|---|
| single | 6.51 |
| double | 10.22 |
| under_10 | 4.64 |

`RoomService::persistSizeCompliance()` runs after create/update. Null `floor_area_sqm` leaves `size_compliant` null (unknown, not non-compliant).

---

## Communal area inspections

### Table: `communal_area_inspections`

Area types: hallway, staircase, kitchen, bathroom, garden, other.

Results: satisfactory, requires_attention, action_required.

Default `next_due_at`: inspected_at + 90 days.

Service methods on `FireSafetyService`: `logCommunalInspection()`, `getOverdueCommunalInspections()`, `getCommunalInspectionHistory()`.

### Routes

| Method | Path |
|---|---|
| GET | `/properties/{property}/communal-inspections` |
| POST | `/properties/{property}/communal-inspections` |

---

## Compliance score keys

`HmoComplianceService` breakdown adds:

| Key | Green | Amber | Red |
|---|---|---|---|
| `room_size` | All rooms measured and compliant | Missing floor area on any room | Any `size_compliant = false` |
| `communal_areas` | Inspections up to date | Overdue &lt; 30 days or none recorded | Overdue ≥ 30 days or latest `action_required` |

HMO weights: `room_size` = 2, `communal_areas` = 1.

---

## Tests

- `tests/Feature/Properties/RoomSizeComplianceTest.php`
- `tests/Feature/Properties/CommunalInspectionTest.php`
