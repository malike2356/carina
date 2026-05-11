<?php

declare(strict_types=1);

return [
    /*
    |--------------------------------------------------------------------------
    | Base design tokens (shared by all presets)
    |--------------------------------------------------------------------------
    */
    'base' => [
        '--color-success' => '22 163 74',
        '--color-warning' => '217 119 6',
        '--color-danger' => '220 38 38',
        '--color-info' => '37 99 235',
        '--surface-base' => '255 255 255',
        '--surface-subtle' => '248 250 252',
        '--surface-muted' => '241 245 249',
        '--surface-overlay' => '226 232 240',
        '--text-primary' => '30 41 59',
        '--text-secondary' => '71 85 105',
        '--text-muted' => '100 116 139',
        '--text-disabled' => '148 163 184',
        '--text-inverse' => '255 255 255',
        '--border-default' => '226 232 240',
        '--border-subtle' => '241 245 249',
        '--border-strong' => '203 213 225',
        '--font-sans' => "'Inter', ui-sans-serif, system-ui, sans-serif",
        '--font-mono' => "ui-monospace, 'Cascadia Code', monospace",
        '--text-xs' => '0.75rem',
        '--text-sm' => '0.8125rem',
        '--text-base' => '0.875rem',
        '--text-md' => '1rem',
        '--text-lg' => '1.125rem',
        '--text-xl' => '1.25rem',
        '--text-2xl' => '1.5rem',
        '--text-3xl' => '1.875rem',
        '--leading-none' => '1',
        '--leading-tight' => '1.25',
        '--leading-snug' => '1.375',
        '--leading-normal' => '1.5',
        '--leading-relaxed' => '1.625',
        '--space-1' => '0.25rem',
        '--space-2' => '0.5rem',
        '--space-3' => '0.75rem',
        '--space-4' => '1rem',
        '--radius-sm' => '0.25rem',
        '--radius-md' => '0.5rem',
        '--radius-lg' => '0.75rem',
        '--radius-xl' => '1rem',
        '--radius-full' => '9999px',
        '--shadow-sm' => '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        '--shadow-md' => '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        '--shadow-lg' => '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        '--shadow-xl' => '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        '--sidebar-width' => '260px',
        '--header-height' => '64px',
        '--max-content-width' => '1280px',
        '--z-dropdown' => '10',
        '--z-header' => '40',
        '--z-sidebar' => '50',
        '--z-modal' => '50',
        '--z-toast' => '60',
    ],

    /*
    |--------------------------------------------------------------------------
    | Core palettes
    |--------------------------------------------------------------------------
    */
    'palettes' => [
        'propreneur_light' => [
            '--color-primary' => '26 54 93',
            '--color-primary-hover' => '21 45 77',
            '--color-secondary' => '13 148 136',
            '--color-secondary-hover' => '15 118 110',
        ],
        'minimal' => [
            '--color-primary' => '71 85 105',
            '--color-primary-hover' => '51 65 85',
            '--color-secondary' => '100 116 139',
            '--color-secondary-hover' => '71 85 105',
        ],
        'dark' => [
            '--color-primary' => '96 165 250',
            '--color-primary-hover' => '59 130 246',
            '--color-secondary' => '45 212 191',
            '--color-secondary-hover' => '20 184 166',
            '--surface-base' => '30 41 59',
            '--surface-subtle' => '15 23 42',
            '--surface-muted' => '51 65 85',
            '--surface-overlay' => '71 85 105',
            '--text-primary' => '241 245 249',
            '--text-secondary' => '203 213 225',
            '--text-muted' => '148 163 184',
            '--text-disabled' => '100 116 139',
            '--border-default' => '51 65 85',
            '--border-subtle' => '30 41 59',
            '--border-strong' => '71 85 105',
        ],
        'high_contrast' => [
            '--color-primary' => '0 0 0',
            '--color-primary-hover' => '0 0 0',
            '--color-secondary' => '26 26 26',
            '--color-secondary-hover' => '0 0 0',
            '--color-success' => '0 0 0',
            '--color-warning' => '0 0 0',
            '--color-danger' => '0 0 0',
            '--color-info' => '0 0 0',
            '--surface-base' => '255 255 255',
            '--surface-subtle' => '255 255 255',
            '--surface-muted' => '255 255 255',
            '--surface-overlay' => '255 255 255',
            '--text-primary' => '0 0 0',
            '--text-secondary' => '0 0 0',
            '--text-muted' => '0 0 0',
            '--text-disabled' => '64 64 64',
            '--text-inverse' => '255 255 255',
            '--border-default' => '0 0 0',
            '--border-subtle' => '0 0 0',
            '--border-strong' => '0 0 0',
            '--font-sans' => 'ui-sans-serif, system-ui, sans-serif',
            '--font-mono' => 'ui-monospace, monospace',
            '--text-xs' => '0.8125rem',
            '--text-sm' => '0.875rem',
            '--text-base' => '1rem',
            '--text-md' => '1.0625rem',
            '--text-lg' => '1.125rem',
            '--text-xl' => '1.25rem',
            '--text-2xl' => '1.5rem',
            '--text-3xl' => '1.875rem',
            '--leading-tight' => '1.35',
            '--leading-normal' => '1.55',
            '--leading-relaxed' => '1.7',
            '--radius-sm' => '0',
            '--radius-md' => '0',
            '--radius-lg' => '0',
            '--radius-xl' => '0',
            '--shadow-sm' => 'none',
            '--shadow-md' => 'none',
            '--shadow-lg' => 'none',
            '--shadow-xl' => 'none',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Workspace colour catalog (tenant appearance)
    |--------------------------------------------------------------------------
    |
    | Central `theme_presets` rows for v1-style brand variants are loaded from
    | database/data/workspace_theme_presets.json via ThemePresetSeeder /
    | WorkspaceThemePresetCatalog (not listed here).
    |
    */
];
