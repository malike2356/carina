<?php

declare(strict_types=1);

/**
 * Platform (central admin) permission matrix catalogue.
 * Names must match rows in the central permissions table (guard: platform).
 */
return [
    'groups' => [
        [
            'key' => 'team',
            'label' => 'Team and access',
            'description' => 'Platform staff, roles, and safe impersonation.',
            'permissions' => [
                [
                    'name' => 'manage-platform-users',
                    'label' => 'Manage platform users',
                    'description' => 'Invite, edit, deactivate, and remove platform users.',
                ],
                [
                    'name' => 'manage-platform-roles',
                    'label' => 'Manage platform roles',
                    'description' => 'Create roles and edit the permission matrix.',
                ],
                [
                    'name' => 'impersonate-platform-users',
                    'label' => 'Impersonate users',
                    'description' => 'Sign in as another platform user for support.',
                ],
            ],
        ],
        [
            'key' => 'saas',
            'label' => 'Workspaces (SaaS tenancy)',
            'description' => 'Tenant lifecycle on the central database.',
            'permissions' => [
                [
                    'name' => 'view-saas-tenants',
                    'label' => 'View tenants',
                    'description' => 'Open tenant list and detail screens (read-only actions).',
                ],
                [
                    'name' => 'manage-saas-tenants',
                    'label' => 'Manage tenants',
                    'description' => 'Create, update, and delete tenants and domains.',
                ],
                [
                    'name' => 'view-subscription-plans',
                    'label' => 'View subscription plans',
                    'description' => 'See the Stripe-linked plan catalogue and module matrix.',
                ],
                [
                    'name' => 'manage-subscription-plans',
                    'label' => 'Manage subscription plans',
                    'description' => 'Create, edit, and remove catalogue plans (modules, limits, Stripe price IDs).',
                ],
                [
                    'name' => 'view-platform-revenue',
                    'label' => 'View platform revenue',
                    'description' => 'Open /admin/revenue for MRR, paid invoices, trends, and exports.',
                ],
            ],
        ],
        [
            'key' => 'accounts',
            'label' => 'Accounts (customer success)',
            'description' => 'Workspace lifecycle, health, follow-ups, and ops digest in platform admin.',
            'permissions' => [
                [
                    'name' => 'view-platform-accounts',
                    'label' => 'View accounts',
                    'description' => 'Open Accounts queue, account detail, timeline, and analytics (read-only).',
                ],
                [
                    'name' => 'manage-platform-accounts',
                    'label' => 'Manage accounts',
                    'description' => 'Create follow-ups, notes, contacts, outreach, and lifecycle updates on accounts.',
                ],
            ],
        ],
        [
            'key' => 'flags',
            'label' => 'Feature flags',
            'description' => 'Rollout controls for product and beta features.',
            'permissions' => [
                [
                    'name' => 'view-feature-flags',
                    'label' => 'View feature flags',
                    'description' => 'See flag catalogue and current values.',
                ],
                [
                    'name' => 'manage-feature-flags',
                    'label' => 'Manage feature flags',
                    'description' => 'Sync catalogue, toggle flags, and edit metadata.',
                ],
            ],
        ],
        [
            'key' => 'search',
            'label' => 'Search',
            'description' => 'Global admin command palette and search API.',
            'permissions' => [
                [
                    'name' => 'use-admin-search',
                    'label' => 'Use admin search',
                    'description' => 'Run cross-module search from the admin header.',
                ],
            ],
        ],
        [
            'key' => 'settings',
            'label' => 'Typed settings',
            'description' => 'Central configuration registry and definitions.',
            'permissions' => [
                [
                    'name' => 'view-typed-settings',
                    'label' => 'View typed settings',
                    'description' => 'Read setting keys and values.',
                ],
                [
                    'name' => 'manage-typed-settings',
                    'label' => 'Manage typed settings',
                    'description' => 'Create, update, and bulk-edit typed settings.',
                ],
                [
                    'name' => 'manage-setting-definitions',
                    'label' => 'Manage setting definitions',
                    'description' => 'Maintain the schema for configurable keys.',
                ],
            ],
        ],
        [
            'key' => 'integrations',
            'label' => 'Integrations',
            'description' => 'Provider keys and operational secrets.',
            'permissions' => [
                [
                    'name' => 'manage-platform-ai-keys',
                    'label' => 'Manage platform AI keys',
                    'description' => 'Edit AI provider configuration in platform settings.',
                ],
            ],
        ],
        [
            'key' => 'backup',
            'label' => 'Backups and DR',
            'description' => 'Platform backup jobs, schedules, destinations, and restore queue visibility.',
            'permissions' => [
                [
                    'name' => 'view-backups',
                    'label' => 'View backups',
                    'description' => 'Open /admin/backups and download completed archives where permitted.',
                ],
                [
                    'name' => 'manage-backups',
                    'label' => 'Manage backups',
                    'description' => 'Queue backups, edit schedules and destinations, delete archives, queue restore jobs.',
                ],
            ],
        ],
        [
            'key' => 'scout',
            'label' => 'SCOUT security console',
            'description' => 'Granular access to the platform SCOUT dashboard (legacy access-scout grants all except key rotation).',
            'permissions' => [
                [
                    'name' => 'scout-view',
                    'label' => 'View SCOUT',
                    'description' => 'Open SCOUT, read posture signals, findings, and activity.',
                ],
                [
                    'name' => 'scout-triage',
                    'label' => 'Triage SCOUT findings',
                    'description' => 'Update finding status and record operator activity notes.',
                ],
                [
                    'name' => 'scout-remediate',
                    'label' => 'Run SCOUT remediation',
                    'description' => 'Execute safe cache clears from SCOUT and per-check remediation buttons.',
                ],
                [
                    'name' => 'scout-audit',
                    'label' => 'Run SCOUT audits',
                    'description' => 'Trigger Composer security audit and PHPStan (Larastan) static analysis from SCOUT.',
                ],
            ],
        ],
        [
            'key' => 'design',
            'label' => 'Design and theme',
            'description' => 'UI lab and workspace theme presets.',
            'permissions' => [
                [
                    'name' => 'access-admin-ui-lab',
                    'label' => 'Access admin UI lab',
                    'description' => 'Open the design system and accessibility tools.',
                ],
                [
                    'name' => 'manage-central-theme-presets',
                    'label' => 'Manage theme presets',
                    'description' => 'Create and publish workspace branding presets.',
                ],
            ],
        ],
    ],
];
