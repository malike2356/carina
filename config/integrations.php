<?php

declare(strict_types=1);

return [

    /*
    |--------------------------------------------------------------------------
    | Outbound webhook event names
    |--------------------------------------------------------------------------
    |
    | Endpoints may subscribe to specific events or use "*" for all events
    | the dispatcher emits. Keep this list aligned with WebhookDispatchService
    | callers across the codebase.
    |
    */

    'webhook_events' => [
        'deal.created',
        'deal.updated',
        'vical.booking.confirmed',
        'vical.booking.needs_review',
        'automation.triggered',
        'ping',
    ],

];
