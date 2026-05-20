<?php

declare(strict_types=1);

use Illuminate\Http\Request;
use Stancl\Tenancy\Exceptions\TenantDatabaseDoesNotExistException;

it('renders a friendly page when the tenant database is missing', function (): void {
    $request = Request::create('https://xelox.propreneur.uk/login', 'GET');

    $response = tenant_database_unavailable_response(
        $request,
        'Database propreneur_t_missing does not exist.',
    );

    expect($response->getStatusCode())->toBe(503)
        ->and($response->getContent())->toContain('Workspace temporarily unavailable');
});

it('maps TenantDatabaseDoesNotExistException to the friendly page', function (): void {
    $handler = app(\Illuminate\Contracts\Debug\ExceptionHandler::class);

    $request = Request::create('https://xelox.propreneur.uk/login', 'GET');
    $exception = new TenantDatabaseDoesNotExistException('propreneur_t_missing');

    $response = $handler->render($request, $exception);

    expect($response->getStatusCode())->toBe(503);
});
