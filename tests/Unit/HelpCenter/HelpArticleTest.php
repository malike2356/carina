<?php

declare(strict_types=1);

use App\Models\Central\HelpArticle;

it('renders markdown to safe html', function (): void {
    $article = new HelpArticle([
        'content' => "## Intro\n\nText with **deals**.",
    ]);

    $html = $article->renderHtml();

    expect($html)->toContain('<h2>')
        ->and($html)->toContain('<strong>deals</strong>');
});

it('extracts table of contents from headings', function (): void {
    $article = new HelpArticle([
        'content' => "## First\n\n### Nested\n\nBody",
    ]);

    $toc = $article->extractToc();

    expect($toc)->toHaveCount(2)
        ->and($toc[0]['text'])->toBe('First')
        ->and($toc[1]['level'])->toBe(3);
});
