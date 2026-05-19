<?php

declare(strict_types=1);

use App\Models\Carina\CarinaConversation;
use App\Services\Mentoring\QuizContextResolver;

it('returns error when no quiz context type', function (): void {
    $resolver = new QuizContextResolver;

    expect($resolver->resolve(1, null))->toHaveKey('error');
});

it('stores quiz context on carina conversation', function (): void {
    $conv = new CarinaConversation([
        'context_type' => 'quiz_active',
        'programme_id' => 3,
    ]);

    expect($conv->context_type)->toBe('quiz_active')
        ->and($conv->programme_id)->toBe(3);
});
