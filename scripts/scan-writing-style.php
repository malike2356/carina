<?php

declare(strict_types=1);

/**
 * Scan brain/knowledge markdown for emoji and dash writing-style violations.
 *
 * Usage: php scripts/scan-writing-style.php
 */
$dir = __DIR__.'/../brain/knowledge';

if (! is_dir($dir)) {
    fwrite(STDERR, "Directory not found: {$dir}\n");
    exit(1);
}

/** @var list<string> */
$violations = [];

$files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir));
foreach ($files as $file) {
    if (! $file->isFile() || $file->getExtension() !== 'md') {
        continue;
    }

    $content = file_get_contents($file->getPathname());
    if ($content === false) {
        continue;
    }

    $lines = explode("\n", $content);
    foreach ($lines as $n => $line) {
        if (preg_match('/[\x{2014}\x{2013}]/u', $line)) {
            $violations[] = $file->getPathname().':'.($n + 1).' [dash] '.trim($line);
        }
        if (preg_match('/[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]/u', $line)) {
            $violations[] = $file->getPathname().':'.($n + 1).' [emoji] '.trim($line);
        }
    }
}

if ($violations === []) {
    echo "No violations found.\n";
    exit(0);
}

echo count($violations)." violations:\n\n";
foreach ($violations as $violation) {
    echo $violation."\n";
}

exit(1);
