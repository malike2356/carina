<?php

declare(strict_types=1);

use App\Http\Controllers\Tenant\DealBoardController;
use Illuminate\Support\Facades\Route;

it('registers the deal board tenant route', function (): void {
    $route = Route::getRoutes()->getByName('tenant.deals.board');

    expect($route)->not->toBeNull()
        ->and($route->uri())->toBe('deals/board')
        ->and($route->getAction('controller'))->toBe(DealBoardController::class.'@index');
});
