<?php

declare(strict_types=1);

it('omits database detail from health JSON when debug is off', function () {
    config(['app.debug' => false]);

    $this->get('/health')
        ->assertOk()
        ->assertJsonMissing(['db']);
});

it('includes database detail in health JSON when debug is on', function () {
    config(['app.debug' => true]);

    $this->get('/health')
        ->assertOk()
        ->assertJsonStructure(['status', 'timestamp', 'db']);
});
