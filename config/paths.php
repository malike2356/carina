<?php

declare(strict_types=1);

/**
 * Repository-relative filesystem roots. Defaults follow the shipped tree under base_path().
 * Override with absolute paths when brain folders live outside the Laravel root (symlinks, NFS, split repos).
 *
 * Per-path env: BRAIN_KNOWLEDGE_PATH, BRAIN_MASTERBRAIN_PATH, BRAIN_PROMPTS_PATH.
 * Carina-specific override (tests, one-off): CARINA_MASTERBRAIN_PATH still wins in CarinaKnowledgeTrainingService::masterbrainBasePath().
 */
$trim = static function (string $path): string {
    return rtrim($path, DIRECTORY_SEPARATOR.'/\\');
};

$kb = env('BRAIN_KNOWLEDGE_PATH');
$mb = env('BRAIN_MASTERBRAIN_PATH');
$pr = env('BRAIN_PROMPTS_PATH');

return [
    'academy' => [
        'workspace_slug' => env('ACADEMY_WORKSPACE_SLUG', 'academy'),
        'public_subdomain' => env('ACADEMY_PUBLIC_SUBDOMAIN', 'academy'),
    ],
    'brain' => [
        'knowledge' => (is_string($kb) && $kb !== '')
            ? $trim((string) $kb)
            : $trim(base_path('brain/knowledge')),
        'masterbrain' => (is_string($mb) && $mb !== '')
            ? $trim((string) $mb)
            : $trim(base_path('brain/masterbrain')),
        'prompts' => (is_string($pr) && $pr !== '')
            ? $trim((string) $pr)
            : $trim(base_path('brain/prompts')),
    ],
];
