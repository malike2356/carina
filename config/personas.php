<?php

declare(strict_types=1);

use App\Billing\BillingModule;

return [
    'mixed' => [
        'name' => 'Full platform',
        'label' => 'Propreneur',
        'slug' => 'mixed',
        'hidden_modules' => [],
        'carina_persona' => null,
        'dashboard_widgets' => [],
        'knowledge_tags' => [],
        'min_billing_modules' => [],
    ],

    'hmo' => [
        'name' => 'HMO Operator',
        'label' => 'Nexio',
        'slug' => 'hmo',
        'hidden_modules' => [
            'pipeline', 'deal_calculators', 'deal_sourcing', 'mentoring',
            'community_deals', 'lead_funnel', 'vical', 'strategy_finder',
        ],
        'carina_persona' => 'hmo_operator',
        'dashboard_widgets' => [
            'occupancy_board',
            'hmo_compliance_overview',
            'rent_overdue_by_room',
            'upcoming_renewals_hmo',
            'quick_actions_hmo',
        ],
        'knowledge_tags' => ['hmo', 'rra_2025', 'fire_safety', 'awaabs_law'],
        'min_billing_modules' => [BillingModule::MultiProperty->value],
    ],

    'btl' => [
        'name' => 'BTL Landlord',
        'label' => 'Let',
        'slug' => 'btl',
        'hidden_modules' => [
            'rooms', 'hmo_compliance', 'shared_bills', 'mentoring',
            'community_deals', 'lead_funnel',
        ],
        'carina_persona' => 'btl_landlord',
        'dashboard_widgets' => ['property_summary', 'rent_overdue', 'upcoming_renewals'],
        'knowledge_tags' => ['btl', 'rra_2025'],
        'min_billing_modules' => [BillingModule::MultiProperty->value],
    ],

    'sourcer' => [
        'name' => 'Deal Sourcer',
        'label' => 'Pulse',
        'slug' => 'sourcer',
        'hidden_modules' => [
            'rooms', 'hmo_compliance', 'shared_bills', 'tenancies', 'mentoring', 'lead_funnel',
        ],
        'carina_persona' => 'deal_sourcer',
        'dashboard_widgets' => ['pipeline_summary', 'deal_feed', 'lead_activity'],
        'knowledge_tags' => ['deal_sourcing', 'calculators', 'sourcing_strategy'],
        'min_billing_modules' => [BillingModule::DealEngine->value],
    ],

    'mentor' => [
        'name' => 'Property Mentor',
        'label' => 'Academy',
        'slug' => 'mentor',
        'hidden_modules' => [
            'rooms', 'hmo_compliance', 'shared_bills', 'deal_sourcing',
        ],
        'carina_persona' => 'property_mentor',
        'dashboard_widgets' => ['cohort_overview', 'mentee_activity', 'upcoming_sessions'],
        'knowledge_tags' => ['mentoring', 'community_learning', 'academy'],
        'min_billing_modules' => [BillingModule::MentoringOs->value],
    ],

    'lodge' => [
        'name' => 'SA Operator',
        'label' => 'Lodge',
        'slug' => 'lodge',
        'hidden_modules' => [
            'rooms', 'hmo_compliance', 'shared_bills', 'mentoring', 'lead_funnel',
            'deal_sourcing', 'community_deals',
        ],
        'carina_persona' => 'sa_operator',
        'dashboard_widgets' => [
            'property_summary',
            'compliance_summary',
            'booking_overview',
            'revenue_vs_target',
        ],
        'knowledge_tags' => ['sa', 'council_article4', 'short_term_letting', 'fire_safety_sa'],
        'min_billing_modules' => [BillingModule::MultiProperty->value],
    ],

    'steward' => [
        'name' => 'Block Management',
        'label' => 'Steward',
        'slug' => 'steward',
        'hidden_modules' => [
            'rooms', 'hmo_compliance', 'shared_bills', 'deal_sourcing', 'deal_calculators',
            'mentoring', 'lead_funnel', 'pipeline', 'community_deals',
        ],
        'carina_persona' => 'block_manager',
        'dashboard_widgets' => [
            'block_compliance_overview',
            'open_maintenance',
            'service_charge_summary',
            'reserve_fund_balance',
        ],
        'knowledge_tags' => ['block_management', 'service_charge', 'leasehold', 's20_consultation'],
        'min_billing_modules' => [BillingModule::MultiProperty->value],
    ],

    'agency' => [
        'name' => 'Letting Agent',
        'label' => 'Agency',
        'slug' => 'agency',
        'hidden_modules' => [
            'deal_sourcing', 'mentoring', 'hmo_compliance', 'rooms', 'shared_bills',
            'community_deals', 'lead_funnel',
        ],
        'carina_persona' => 'letting_agent',
        'dashboard_widgets' => [
            'client_portfolio_overview',
            'compliance_summary',
            'fee_income_summary',
            'upcoming_renewals',
        ],
        'knowledge_tags' => ['letting_agent', 'cmp', 'arla', 'rra_2025'],
        'min_billing_modules' => [BillingModule::MultiProperty->value],
    ],

    'forge' => [
        'name' => 'Developer / Refurb',
        'label' => 'Forge',
        'slug' => 'forge',
        'hidden_modules' => [
            'rooms', 'hmo_compliance', 'shared_bills', 'mentoring', 'lead_funnel',
            'tenancies', 'community_deals',
        ],
        'carina_persona' => 'developer',
        'dashboard_widgets' => [
            'project_pipeline',
            'build_cost_vs_budget',
            'completion_forecast',
            'drawdown_tracker',
        ],
        'knowledge_tags' => ['development', 'planning_permission', 'cil_levy', 'building_regs'],
        'min_billing_modules' => [BillingModule::DealEngine->value],
    ],

    'bridge' => [
        'name' => 'Rent-to-Rent',
        'label' => 'Bridge',
        'slug' => 'bridge',
        'hidden_modules' => [
            'deal_sourcing', 'mentoring', 'hmo_compliance', 'rooms', 'shared_bills',
            'lead_funnel', 'community_deals',
        ],
        'carina_persona' => 'r2r_operator',
        'dashboard_widgets' => [
            'r2r_margin_summary',
            'rent_vs_sublease_income',
            'expiry_pipeline',
            'compliance_summary',
        ],
        'knowledge_tags' => ['r2r', 'guaranteed_rent', 'management_agreement', 'r2r_legal_structure'],
        'min_billing_modules' => [BillingModule::DealEngine->value, BillingModule::MultiProperty->value],
    ],

    'hall' => [
        'name' => 'Student Lettings',
        'label' => 'Hall',
        'slug' => 'hall',
        'hidden_modules' => [
            'deal_sourcing', 'mentoring', 'lead_funnel', 'hmo_compliance', 'shared_bills',
            'pipeline', 'deal_calculators', 'community_deals',
        ],
        'carina_persona' => 'student_lettings',
        'dashboard_widgets' => [
            'student_occupancy_board',
            'semester_income_forecast',
            'void_summer_alert',
            'compliance_summary',
        ],
        'knowledge_tags' => ['student_lettings', 'guarantor_agreements', 'student_loans', 'academic_calendar'],
        'min_billing_modules' => [BillingModule::MultiProperty->value],
    ],
];
