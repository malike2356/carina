<?php

declare(strict_types=1);

it('does not expose central database name on unknown tenant host when debug is off', function () {
    config(['app.debug' => false]);

    $response = $this->get('http://nonexistent-workspace-abc999.propreneur.test/login');

    $response->assertNotFound();
    $response->assertDontSee('propreneur_testing', false);
    $response->assertDontSee('INSERT INTO domains', false);
});

it('exposes extended diagnostics when debug is on', function () {
    config(['app.debug' => true]);

    $response = $this->get('http://nonexistent-workspace-abc999.propreneur.test/login');

    $response->assertNotFound();
    $response->assertSee('propreneur_testing', false);
});
