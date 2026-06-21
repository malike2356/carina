<?php

declare(strict_types=1);

it('redirects legacy platform login url to platform login', function (): void {
    $this->get('http://propreneur.test/login')
        ->assertRedirect('http://propreneur.test/platform/login');
});

it('redirects mistaken account login url to platform login', function (): void {
    $this->get('http://propreneur.test/account/login')
        ->assertRedirect('http://propreneur.test/platform/login');
});

it('redirects mistaken account register url to platform register', function (): void {
    $this->get('http://propreneur.test/account/register')
        ->assertRedirect('http://propreneur.test/platform/register');
});

it('accepts legacy platform login post on central host', function (): void {
    $this->post('http://propreneur.test/login', [
        'email' => 'nobody@example.com',
        'password' => 'wrong',
    ])
        ->assertRedirect()
        ->assertSessionHasErrors('email');
});
