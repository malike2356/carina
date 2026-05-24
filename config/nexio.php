<?php

declare(strict_types=1);

return [
    /*
    |--------------------------------------------------------------------------
    | Renters' Rights Act 2025 implementation date
    |--------------------------------------------------------------------------
    |
    | Tenancies starting on or after this date cannot use Section 21 (Form 6A).
    | Used by the Nexio legal notice toolkit.
    |
    */
    'rra_2025_implementation_date' => env('RRA_2025_IMPLEMENTATION_DATE', '2025-10-01'),
];
