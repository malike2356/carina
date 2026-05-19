<?php

declare(strict_types=1);

/**
 * Baseline count of unescaped Blade `{!!` directives under resources/views.
 * Increase only when output is platform-controlled and documented with {{-- safe: ... --}}.
 */
const BLADE_UNESCAPED_OUTPUT_BASELINE = 31;

it('does not increase unescaped Blade output beyond the established baseline', function (): void {
    $viewsPath = base_path('resources/views');
    $count = 0;

    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($viewsPath, FilesystemIterator::SKIP_DOTS),
    );

    foreach ($iterator as $file) {
        if (! $file->isFile() || ! str_ends_with($file->getFilename(), '.blade.php')) {
            continue;
        }

        $contents = file_get_contents($file->getPathname());
        if ($contents === false) {
            continue;
        }

        $count += substr_count($contents, '{!!');
    }

    expect($count)
        ->toBeLessThanOrEqual(BLADE_UNESCAPED_OUTPUT_BASELINE)
        ->and($count)->toBeGreaterThan(0);
});
