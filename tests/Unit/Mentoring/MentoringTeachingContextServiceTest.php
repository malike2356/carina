<?php

declare(strict_types=1);

use App\Models\Carina\CarinaConversation;
use App\Services\Mentoring\MentoringCarinaSettingsService;
use App\Services\Mentoring\MentoringTeachingContextService;

it('applies when programme context is mentor teaching and not impersonated', function (): void {
    $conversation = new CarinaConversation([
        'context_type' => 'mentor_teaching',
        'programme_id' => 1,
        'context_id' => 1,
        'is_impersonated' => false,
    ]);

    $service = new MentoringTeachingContextService(new MentoringCarinaSettingsService);

    expect($service->applies($conversation))->toBeTrue();
});

it('does not apply when impersonated', function (): void {
    $conversation = new CarinaConversation([
        'context_type' => 'mentor_teaching',
        'programme_id' => 1,
        'is_impersonated' => true,
    ]);

    $service = new MentoringTeachingContextService(new MentoringCarinaSettingsService);

    expect($service->applies($conversation))->toBeFalse();
});

it('does not apply without programme context', function (): void {
    $conversation = new CarinaConversation([
        'context_type' => 'deal',
        'is_impersonated' => false,
    ]);

    $service = new MentoringTeachingContextService(new MentoringCarinaSettingsService);

    expect($service->applies($conversation))->toBeFalse();
});
