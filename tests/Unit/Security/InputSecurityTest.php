<?php

declare(strict_types=1);

use App\Http\Middleware\XssInputFilter;
use App\Rules\NoHtml;
use App\Rules\SafeUrl;
use App\Rules\UkPostcode;
use App\Services\Security\HtmlPurifierService;
use App\Services\Security\SafeRedirectService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

it('accepts valid UK postcodes via UkPostcode rule', function (string $postcode): void {
    $validator = Validator::make(
        ['postcode' => $postcode],
        ['postcode' => [new UkPostcode]],
    );

    expect($validator->passes())->toBeTrue();
})->with([
    'M1 1AE',
    'SW1A 2AA',
    'EC1A 1BB',
]);

it('rejects invalid postcodes via UkPostcode rule', function (): void {
    $validator = Validator::make(
        ['postcode' => '90210'],
        ['postcode' => [new UkPostcode]],
    );

    expect($validator->fails())->toBeTrue();
});

it('accepts same-host https URLs via SafeUrl rule', function (): void {
    config(['app.url' => 'https://propreneur.test']);

    $validator = Validator::make(
        ['url' => 'https://propreneur.test/dashboard'],
        ['url' => [new SafeUrl]],
    );

    expect($validator->passes())->toBeTrue();
});

it('rejects javascript scheme URLs via SafeUrl rule', function (): void {
    $validator = Validator::make(
        ['url' => 'javascript:alert(1)'],
        ['url' => [new SafeUrl]],
    );

    expect($validator->fails())->toBeTrue();
});

it('rejects external hosts when allowExternal is false', function (): void {
    config(['app.url' => 'https://propreneur.test']);

    $validator = Validator::make(
        ['url' => 'http://evil.com/phish'],
        ['url' => [new SafeUrl(allowExternal: false)]],
    );

    expect($validator->fails())->toBeTrue();
});

it('strips script tags in HtmlPurifierService::purify', function (): void {
    $purified = app(HtmlPurifierService::class)->purify('<p>Hello</p><script>alert(1)</script>');

    expect($purified)->not->toContain('<script')
        ->and($purified)->toContain('<p>Hello</p>');
});

it('keeps allowed tags in HtmlPurifierService::purify', function (): void {
    $purified = app(HtmlPurifierService::class)->purify('<p>Hi <strong>there</strong></p><a href="https://example.com">link</a>');

    expect($purified)->toContain('<p>')
        ->and($purified)->toContain('<strong>')
        ->and($purified)->toContain('<a href');
});

it('strips dangerous javascript hrefs in HtmlPurifierService::purify', function (): void {
    $purified = app(HtmlPurifierService::class)->purify('<a href="javascript:alert(1)">click</a>');

    expect($purified)->not->toContain('javascript:');
});

it('strips null bytes from form input via XssInputFilter middleware', function (): void {
    $middleware = app(XssInputFilter::class);
    $request = Request::create('/contacts', 'POST', [
        'name' => "evil\0name",
    ]);

    $middleware->handle($request, fn (Request $req) => response('ok'));

    expect($request->input('name'))->toBe('evilname');
});

it('returns default URL for external redirects via SafeRedirectService', function (): void {
    config(['app.url' => 'https://propreneur.test']);

    $url = app(SafeRedirectService::class)->safeRedirectUrl(
        'https://evil.com/steal',
        '/dashboard',
    );

    expect($url)->toBe('/dashboard');
});

it('returns default URL for javascript redirect schemes via SafeRedirectService', function (): void {
    config(['app.url' => 'https://propreneur.test']);

    $url = app(SafeRedirectService::class)->safeRedirectUrl(
        'javascript:alert(1)',
        '/',
    );

    expect($url)->toBe('/');
});

it('rejects strings containing HTML via NoHtml rule', function (): void {
    $validator = Validator::make(
        ['name' => '<script>alert(1)</script>'],
        ['name' => [new NoHtml]],
    );

    expect($validator->fails())->toBeTrue();
});
