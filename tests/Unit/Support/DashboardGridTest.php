<?php

declare(strict_types=1);

use App\Support\Dashboard\DashboardGrid;

it('uses three columns for nine tiles to avoid a lone orphan', function (): void {
    expect(DashboardGrid::classes(9))->toContain('lg:grid-cols-3');
});

it('uses five columns for five overview stats', function (): void {
    expect(DashboardGrid::classes(5))->toContain('lg:grid-cols-5');
});

it('uses four columns for eight tiles', function (): void {
    expect(DashboardGrid::classes(8))->toContain('lg:grid-cols-4');
});

it('uses seven columns on xl for seven tiles', function (): void {
    expect(DashboardGrid::classes(7))->toContain('xl:grid-cols-7');
});

it('uses two by two until large for four overview stats', function (): void {
    expect(DashboardGrid::classes(4))->toContain('grid-cols-2')
        ->and(DashboardGrid::classes(4))->toContain('lg:grid-cols-4')
        ->and(DashboardGrid::classes(4))->not->toContain('sm:grid-cols-3');
});
