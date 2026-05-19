<?php

declare(strict_types=1);

it('adds modern security headers', function (): void {
    $response = $this->get('/up');

    $response->assertHeader('X-Content-Type-Options', 'nosniff');
    $response->assertHeader('X-Frame-Options', 'SAMEORIGIN');
    $response->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    $response->assertHeader('X-XSS-Protection', '0');
});

it('adds a content security policy header', function (): void {
    $response = $this->get('/up');

    expect($response->headers->get('Content-Security-Policy'))->not->toBeEmpty();
});

it('allows the current Alpine expression runtime under CSP', function (): void {
    $response = $this->get('/up');

    expect($response->headers->get('Content-Security-Policy'))
        ->toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
});

it('allows configured Google Fonts assets under CSP', function (): void {
    $response = $this->get('/up');
    $csp = $response->headers->get('Content-Security-Policy');

    expect($csp)
        ->toContain("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com")
        ->toContain("style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com")
        ->toContain("font-src 'self' https://fonts.gstatic.com");
});

it('allows course video playback sources under CSP', function (): void {
    $response = $this->get('/up');
    $csp = $response->headers->get('Content-Security-Policy');

    expect($csp)
        ->toContain("media-src 'self' blob:")
        ->toContain("frame-src 'self' https://www.youtube-nocookie.com https://player.vimeo.com https://www.loom.com https://loom.com");
});
