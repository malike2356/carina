<?php

declare(strict_types=1);

use App\Services\Carina\CarinaService;

it('strips pseudo search tool markup from assistant text', function (): void {
    $svc = app(CarinaService::class);
    $m = new ReflectionMethod(CarinaService::class, 'stripPseudoToolMarkup');
    $m->setAccessible(true);

    $raw = "Here is what I found.\n<search>Who is X?</search>\nMore text.";
    expect($m->invoke($svc, $raw))->toBe("Here is what I found.\n\nMore text.");
});

it('strips tool_call blocks from assistant text', function (): void {
    $svc = app(CarinaService::class);
    $m = new ReflectionMethod(CarinaService::class, 'stripPseudoToolMarkup');
    $m->setAccessible(true);

    $raw = "Start\n<tool_call>query</tool_call>\nEnd.";
    expect($m->invoke($svc, $raw))->toBe("Start\n\nEnd.");
});

it('recovers inner text when pseudo-tool blocks are the only output', function (): void {
    $svc = app(CarinaService::class);
    $m = new ReflectionMethod(CarinaService::class, 'finalizeAssistantReply');
    $m->setAccessible(true);

    expect($m->invoke($svc, '<search>Laud Paul-Gablah</search>', '', 'tenant'))->toBe('Laud Paul-Gablah');

    $onlyTags = '<search>x</search><tool_call>y</tool_call>';
    expect($m->invoke($svc, $onlyTags, '', 'tenant'))->toBe("x\n\ny");
});

it('uses a generic fallback when nothing usable remains after stripping', function (): void {
    $svc = app(CarinaService::class);
    $m = new ReflectionMethod(CarinaService::class, 'finalizeAssistantReply');
    $m->setAccessible(true);

    expect($m->invoke($svc, '<search></search><tool_call>  </tool_call>', '', 'tenant'))->toContain('could not generate');
});

it('loads canonical product inventory and persona attribution from config', function (): void {
    expect(trim((string) config('ai.carina_product_inventory')))->not->toBe('')
        ->and(config('ai.carina_persona'))->toContain('VERLOX');
});
