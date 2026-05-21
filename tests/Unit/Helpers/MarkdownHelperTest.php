<?php

declare(strict_types=1);

use App\Helpers\MarkdownHelper;

it('renders bold headings lists and horizontal rules for carina markdown', function (): void {
    $input = <<<'MD'
Here is the full picture on **Joshua Pratt**.

---

**Contact basics**
- Name: Joshua Pratt
- Email: josh.pratt@email.com
- Investor score: 8/100 (low -- note)

**Your options**
1. **Run an AML check**
2. Log a note
MD;

    $html = MarkdownHelper::convert($input);

    expect($html)
        ->toContain('<strong>Joshua Pratt</strong>')
        ->toContain('<hr')
        ->toContain('<strong>Contact basics</strong>')
        ->toContain('<ul')
        ->toContain('<ol')
        ->not->toContain('**Joshua');
});
