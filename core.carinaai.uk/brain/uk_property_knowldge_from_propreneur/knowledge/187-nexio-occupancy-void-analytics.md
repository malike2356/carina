# Nexio: Occupancy board + void analytics (Prompt 220)

## Routes (MultiProperty feature)

| Route | Controller | Purpose |
|-------|------------|---------|
| `GET /rooms/occupancy-board` | `OccupancyBoardController@index` | Card grid or table view of all HMO rooms |
| `PATCH /rooms/occupancy-board/{room}/status` | `OccupancyBoardController@updateStatus` | Status change with confirmation |
| `GET /rooms/void-analytics` | `VoidAnalyticsController@index` | Void rate trend, longest voids, loss by room |

Named routes: `tenant.properties.rooms.occupancy-board`, `tenant.properties.rooms.occupancy-board.status`, `tenant.properties.rooms.void-analytics`.

## Data model

`room_status_history` - one open row per room (`ended_at` null). Transitions via `RoomStatusHistoryService::transitionStatus()` from `RoomService::updateRoom()` and `recordInitialStatus()` on `createRoom()`.

## Services

- `OccupancyBoardService` - portfolio + per-property room cards with quick-action URLs
- `VoidAnalyticsService` - average void period, current voids, void loss by room, portfolio void rate + monthly trend
- `RoomStatusHistoryService` - open/close history, `daysInCurrentStatus`, `totalVoidDays`

## P&L integration

`RoomService::roomPl()` adds `total_void_days` and `estimated_void_loss` (rent_pcm / 30 × void days). Shown on `tenant/properties/rooms/pl.blade.php`.

## Dashboard widget

`widgets/occupancy_board.blade.php` links to the full occupancy board.

## Tests

`tests/Feature/Properties/VoidTrackingTest.php`
