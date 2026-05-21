<?php

declare(strict_types=1);

return [
    'ticket_prefix' => env('PLATFORM_SUPPORT_TICKET_PREFIX', 'SUP'),
    'notify_email' => env(
        'PLATFORM_SUPPORT_NOTIFY_EMAIL',
        env('REMOTE_ACCESS_SUPPORT_EMAIL', env('MAIL_FROM_ADDRESS', 'support@example.com'))
    ),

    /*
    | Slack Incoming Webhook URL for the ops channel (e.g. #propreneur_support).
    | Create in Slack: channel → Integrations → Incoming Webhooks.
    | Requires feature flag platform_support_slack_notify.
    */
    'slack_webhook_url' => env('PLATFORM_SUPPORT_SLACK_WEBHOOK_URL', ''),

    /*
    | Trello REST API (secrets in .env; board/list IDs in admin Support → Trello settings).
    | Create token: https://trello.com/app-key → generate token with read,write scope.
    */
    'trello' => [
        'api_key' => env('TRELLO_API_KEY', ''),
        'token' => env('TRELLO_TOKEN', ''),
        'board_id' => env('TRELLO_SUPPORT_BOARD_ID', ''),
        'list_inbox_id' => env('TRELLO_SUPPORT_LIST_INBOX_ID', ''),
        'list_done_id' => env('TRELLO_SUPPORT_LIST_DONE_ID', ''),
    ],
];
