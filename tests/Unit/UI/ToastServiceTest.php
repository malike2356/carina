<?php

use App\Services\UI\ToastService;

it('queues toast messages in session', function () {
    $service = new ToastService;

    $service->success('Saved!');
    $service->error('Something failed.');

    $pending = $service->pending();

    expect($pending)->toHaveCount(2)
        ->and($pending[0])->toMatchArray(['type' => 'success', 'message' => 'Saved!'])
        ->and($pending[1])->toMatchArray(['type' => 'error',   'message' => 'Something failed.']);
});

it('clears pending toasts', function () {
    $service = new ToastService;
    $service->info('Hello');
    $service->clear();

    expect($service->pending())->toBeEmpty();
});

it('consuming pending toasts removes them from session', function () {
    $service = new ToastService;
    $service->warning('Watch out!');

    $service->pending(); // consumes

    expect($service->pending())->toBeEmpty();
});
