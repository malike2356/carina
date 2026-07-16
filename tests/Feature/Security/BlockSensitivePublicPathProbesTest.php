<?php

declare(strict_types=1);

it('returns 404 for .env path probe on web stack', function () {
    $this->get('/.env')->assertNotFound();
});

it('returns 404 for nested .git path probe', function () {
    $this->get('/foo/.git/config')->assertNotFound();
});
