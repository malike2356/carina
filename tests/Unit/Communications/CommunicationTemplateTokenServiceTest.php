<?php

declare(strict_types=1);

use App\Models\Tenant\Contact;
use App\Services\Communications\CommunicationTemplateTokenService;

it('replaces comms hub tokens from merged context', function (): void {
    $contact = new Contact([
        'first_name' => 'Alex',
        'name' => 'Alex Investor',
    ]);

    $svc = new CommunicationTemplateTokenService;
    $data = [
        'deal_title' => '12 High St',
        'property_address' => '12 High Street',
        'stage_name' => 'Offer',
        'workspace_name' => 'Xelox Properties',
        'workspace_booking_link' => 'https://xelox.example/book/demo',
        'booking_guest_name' => 'Sam Guest',
        'booking_guest_email' => 'sam@guest.test',
        'booking_starts_at' => 'Mon 5 May 2026 14:00 (Europe/London)',
        'booking_event_name' => 'Investor call',
        'booking_join_url' => 'https://zoom.example/j/123',
        'booking_host_name' => 'Jamie Host',
    ];

    $body = 'Hi {{first_name}}, deal {{deal_title}} at {{property_address}} ({{stage_name}}). '
        .'Workspace {{workspace.name}} book at {{workspace.booking_link}}. '
        .'{{booking.guest_name}} <{{booking.guest_email}}> for {{booking.event_name}} on {{booking.starts_at}}. '
        .'Join: {{booking.join_url}}. Host: {{booking.host_name}}.';

    $out = $svc->replace($body, $contact, $data);

    expect($out)->toBe(
        'Hi Alex, deal 12 High St at 12 High Street (Offer). '
        .'Workspace Xelox Properties book at https://xelox.example/book/demo. '
        .'Sam Guest <sam@guest.test> for Investor call on Mon 5 May 2026 14:00 (Europe/London). '
        .'Join: https://zoom.example/j/123. Host: Jamie Host.'
    );
});

it('uses contact name when first_name is empty', function (): void {
    $contact = new Contact(['first_name' => '', 'name' => 'Pat Lee']);
    $svc = new CommunicationTemplateTokenService;
    $out = $svc->replace('Hello {{first_name}}', $contact, []);

    expect($out)->toBe('Hello Pat Lee');
});
