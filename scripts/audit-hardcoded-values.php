<?php

declare(strict_types=1);

/**
 * Scans PHP files for hardcoded financial/regulatory values.
 * Looks for patterns like: 0.24, 0.40, 40000, 12570, 0.03, etc.
 * These may be tax rates, thresholds, or rate assumptions.
 *
 * Usage: php scripts/audit-hardcoded-values.php
 */

$root = dirname(__DIR__);

$dirs = [
    $root.'/app/Services/Carina/',
    $root.'/app/Services/Tax/',
    $root.'/app/Services/Deals/',
    $root.'/app/Services/Accounting/',
    $root.'/app/Services/Property/',
];

$patterns = [
    '/0\.(18|20|24|28|40|45)\b/' => 'Possible tax rate (18%, 20%, 24%, 28%, 40%, 45%)',
    '/\b(12570|50270|125140)\b/' => 'Possible income tax threshold',
    '/\b(3000|6000|12300)\b/' => 'Possible CGT annual exemption',
    '/\b(125000|250000|925000)\b/' => 'Possible SDLT threshold',
    '/0\.0[2-6]\b/' => 'Possible interest/surcharge rate (2-6%)',
    '/"rate"\s*=>\s*0\.\d+/' => 'Hardcoded rate in array',
];

$violations = [];

foreach ($dirs as $dir) {
    if (! is_dir($dir)) {
        continue;
    }

    $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir));
    foreach ($files as $file) {
        if ($file->getExtension() !== 'php') {
            continue;
        }

        $pathname = $file->getPathname();
        if (str_contains($pathname, 'PropertyConstantsService.php')) {
            continue;
        }

        $content = file_get_contents($pathname);
        if ($content === false) {
            continue;
        }

        $lines = explode("\n", $content);
        foreach ($lines as $n => $line) {
            $trimmed = trim($line);
            if ($trimmed === '' || str_starts_with($trimmed, '//') || str_starts_with($trimmed, '*')) {
                continue;
            }
            if (str_contains($line, 'property_constants') || str_contains($line, 'PropertyConstantsService')) {
                continue;
            }

            foreach ($patterns as $pattern => $label) {
                if (preg_match($pattern, $line)) {
                    $violations[] = [
                        'file' => str_replace($root.'/', '', $pathname),
                        'line' => $n + 1,
                        'label' => $label,
                        'content' => $trimmed,
                    ];
                }
            }
        }
    }
}

if ($violations === []) {
    echo "No hardcoded value patterns found.\n";
    exit(0);
}

echo count($violations)." potential hardcoded values found:\n\n";
foreach ($violations as $v) {
    echo "[{$v['label']}]\n  {$v['file']}:{$v['line']}\n  {$v['content']}\n\n";
}

exit(1);
