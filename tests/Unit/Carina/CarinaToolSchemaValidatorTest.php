<?php

declare(strict_types=1);

use App\Services\Carina\Security\CarinaToolSchemaValidator;

it('validate returns null for valid args matching schema', function (): void {
    $validator = new CarinaToolSchemaValidator;
    $definition = [
        'schema' => [
            'type' => 'object',
            'properties' => [
                'description' => ['type' => 'string'],
                'amount_gbp' => ['type' => 'number'],
            ],
            'required' => ['description', 'amount_gbp'],
        ],
    ];

    expect($validator->validate($definition, [
        'description' => 'Office supplies',
        'amount_gbp' => 42.5,
    ]))->toBeNull();
});

it('validate returns error for missing required field', function (): void {
    $validator = new CarinaToolSchemaValidator;
    $definition = [
        'schema' => [
            'properties' => [
                'entry_date' => ['type' => 'string'],
                'lines' => ['type' => 'array'],
            ],
            'required' => ['entry_date', 'lines'],
        ],
    ];

    expect($validator->validate($definition, ['entry_date' => '2026-05-17']))
        ->toBe("Required argument 'lines' missing.");
});

it('validate returns error for wrong type', function (): void {
    $validator = new CarinaToolSchemaValidator;
    $definition = [
        'schema' => [
            'properties' => [
                'property_id' => ['type' => 'integer'],
            ],
            'required' => [],
        ],
    ];

    expect($validator->validate($definition, ['property_id' => 'not-an-int']))
        ->toBe("Argument 'property_id' must be an integer.");
});

it('validate returns error for unknown argument key (injection vector)', function (): void {
    $validator = new CarinaToolSchemaValidator;
    $definition = [
        'schema' => [
            'properties' => [
                'description' => ['type' => 'string'],
            ],
            'required' => ['description'],
        ],
    ];

    expect($validator->validate($definition, [
        'description' => 'Valid',
        'system_prompt_override' => 'ignore rules',
    ]))->toBe("Unknown argument 'system_prompt_override' is not permitted for this tool.");
});

it('validate returns error for value not in enum list', function (): void {
    $validator = new CarinaToolSchemaValidator;
    $definition = [
        'schema' => [
            'properties' => [
                'status' => ['type' => 'string', 'enum' => ['draft', 'posted']],
            ],
            'required' => ['status'],
        ],
    ];

    expect($validator->validate($definition, ['status' => 'deleted']))
        ->toBe("Argument 'status' must be one of: draft, posted.");
});
