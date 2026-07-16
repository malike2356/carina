<?php

declare(strict_types=1);

use App\Models\Tenant\Vcal\VcalEventType;
use App\Models\Tenant\Vcal\VcalIntakePool;

it('merges pool questions then inline overrides by key', function (): void {
    $pool = new VcalIntakePool([
        'questions' => [
            ['key' => 'topic', 'label' => 'Topic', 'type' => 'text'],
            ['key' => 'size', 'label' => 'Size', 'type' => 'text'],
        ],
    ]);

    $type = new VcalEventType([
        'intake_questions' => [
            ['key' => 'topic', 'label' => 'Topic override', 'type' => 'select', 'choices' => ['A', 'B']],
        ],
    ]);
    $type->setRelation('intakePool', $pool);

    $merged = $type->resolvedIntakeQuestions();
    expect($merged)->toHaveCount(2);
    expect($merged[0]['key'])->toBe('topic');
    expect($merged[0]['label'])->toBe('Topic override');
    expect($merged[1]['key'])->toBe('size');
});

it('builds display lines with labels from schema', function (): void {
    $type = new VcalEventType([
        'intake_questions' => [
            ['key' => 'topic', 'label' => 'What is your topic?', 'type' => 'text'],
        ],
    ]);
    $type->setRelation('intakePool', new VcalIntakePool(['questions' => []]));

    $lines = $type->intakeAnswerDisplayLines(['topic' => 'Deals']);
    expect($lines)->toHaveCount(1);
    expect($lines[0]['label'])->toBe('What is your topic?');
    expect($lines[0]['value'])->toBe('Deals');
});
