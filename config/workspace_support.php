<?php

declare(strict_types=1);

return [
  'whatsapp_url' => env('WORKSPACE_SUPPORT_WHATSAPP_URL', ''),
  'email' => env('WORKSPACE_SUPPORT_EMAIL', env('REMOTE_ACCESS_SUPPORT_EMAIL', env('MAIL_FROM_ADDRESS', 'support@propreneur.uk'))),
  'help_centre_url' => env('WORKSPACE_HELP_CENTRE_URL', ''),
  'book_call_url' => env('WORKSPACE_BOOK_CALL_URL', ''),
];
