<?php

declare(strict_types=1);

use App\Services\Carina\Insights\ConversationPreRedactor;

it('redacts email addresses', function (): void {
    $r = new ConversationPreRedactor;
    expect($r->redact('Contact me at john.doe@example.co.uk about the deal'))->toContain('[email]');
});

it('redacts full uk postcodes but keeps area', function (): void {
    $r = new ConversationPreRedactor;
    $result = $r->redact('The property is in B15 3QX, near the station');
    expect($result)->toContain('B15')
        ->and($result)->not->toContain('3QX');
});

it('does not redact property prices or yields', function (): void {
    $r = new ConversationPreRedactor;
    $result = $r->redact('Purchase price £185,000, gross yield 7.2%');
    expect($result)->toContain('£185,000')
        ->and($result)->toContain('7.2%');
});

it('redacts uk phone numbers', function (): void {
    $r = new ConversationPreRedactor;
    expect($r->redact('Call me on 07712 345678'))->toContain('[phone]');
});
