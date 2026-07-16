<?php

declare(strict_types=1);

return [
    'forms' => [
        'client_onboarding' => [
            'label' => 'Client onboarding',
            'description' => 'Initial take-on details for a new client.',
            'fields' => [
                ['name' => 'client_legal_name', 'type' => 'text', 'label' => 'Client legal name', 'required' => true],
                ['name' => 'trading_name', 'type' => 'text', 'label' => 'Trading name', 'required' => false],
                ['name' => 'client_type', 'type' => 'select', 'label' => 'Client type', 'required' => true, 'options' => ['individual' => 'Individual', 'company' => 'Company', 'partnership' => 'Partnership', 'trust' => 'Trust', 'other' => 'Other']],
                ['name' => 'primary_email', 'type' => 'email', 'label' => 'Primary email', 'required' => false],
                ['name' => 'primary_phone', 'type' => 'tel', 'label' => 'Primary phone', 'required' => false],
                ['name' => 'registered_address', 'type' => 'textarea', 'label' => 'Registered / correspondence address', 'required' => false],
                ['name' => 'intended_services', 'type' => 'textarea', 'label' => 'Intended services / relationship', 'required' => false],
                ['name' => 'pep_sanctions_notes', 'type' => 'textarea', 'label' => 'PEP / sanctions screening notes (internal)', 'required' => false],
            ],
        ],
        'company_entity_information' => [
            'label' => 'Company / entity client information',
            'description' => 'Corporate structure and contact points.',
            'fields' => [
                ['name' => 'legal_entity_name', 'type' => 'text', 'label' => 'Legal entity name', 'required' => true],
                ['name' => 'company_number', 'type' => 'text', 'label' => 'Company / registration number', 'required' => false],
                ['name' => 'jurisdiction', 'type' => 'text', 'label' => 'Jurisdiction of incorporation', 'required' => false],
                ['name' => 'registered_office', 'type' => 'textarea', 'label' => 'Registered office address', 'required' => false],
                ['name' => 'trading_address', 'type' => 'textarea', 'label' => 'Trading address (if different)', 'required' => false],
                ['name' => 'authorised_signatories', 'type' => 'textarea', 'label' => 'Authorised signatories', 'required' => false],
                ['name' => 'ubo_notes', 'type' => 'textarea', 'label' => 'Beneficial ownership notes', 'required' => false],
            ],
        ],
        'company_client_risk_assessment' => [
            'label' => 'Company client risk assessment',
            'description' => 'Risk rating and rationale for periodic AML review.',
            'fields' => [
                ['name' => 'risk_rating', 'type' => 'select', 'label' => 'Risk rating', 'required' => true, 'options' => ['low' => 'Low', 'medium' => 'Medium', 'high' => 'High', 'not_assessed' => 'Not assessed']],
                ['name' => 'rationale', 'type' => 'textarea', 'label' => 'Rationale', 'required' => false],
                ['name' => 'mitigations', 'type' => 'textarea', 'label' => 'Mitigations / controls', 'required' => false],
                ['name' => 'next_review_date', 'type' => 'date', 'label' => 'Next review date', 'required' => false],
            ],
        ],
        'client_dd_checklist' => [
            'label' => 'Client due diligence checklist',
            'description' => 'Tick client due diligence checks completed.',
            'fields' => [
                ['name' => 'dd_items', 'type' => 'checkbox_group', 'label' => 'Checks completed', 'required' => false, 'items' => [
                    ['name' => 'identity_verified', 'label' => 'Identity verified'],
                    ['name' => 'address_verified', 'label' => 'Address verified'],
                    ['name' => 'company_registers_checked', 'label' => 'Company registers checked'],
                    ['name' => 'source_of_funds_reviewed', 'label' => 'Source of funds / wealth reviewed'],
                    ['name' => 'pep_screening_done', 'label' => 'PEP screening completed'],
                    ['name' => 'sanctions_screening_done', 'label' => 'Sanctions screening completed'],
                    ['name' => 'edd_completed_where_required', 'label' => 'EDD completed where required'],
                ]],
                ['name' => 'checklist_notes', 'type' => 'textarea', 'label' => 'Additional notes', 'required' => false],
            ],
        ],
        'property_deal_dd_pack' => [
            'label' => 'Property deal due diligence pack',
            'description' => 'Structured diligence checklist and notes for a specific property deal.',
            'fields' => [
                ['name' => 'property_summary', 'type' => 'text', 'label' => 'Property short label', 'required' => true],
                ['name' => 'postcode', 'type' => 'text', 'label' => 'Postcode', 'required' => false],
                ['name' => 'local_authority', 'type' => 'text', 'label' => 'Local authority', 'required' => false],
                ['name' => 'strategy', 'type' => 'select', 'label' => 'Strategy', 'required' => false, 'options' => ['btl' => 'BTL', 'hmo' => 'HMO', 'brr' => 'BRR', 'r2r' => 'R2R', 'sa' => 'SA / serviced', 'flip' => 'Flip', 'sourcing' => 'Sourcing', 'other' => 'Other']],
                ['name' => 'dd_checks_legal_title', 'type' => 'checkbox_group', 'label' => 'Legal / title', 'required' => false, 'items' => [
                    ['name' => 'dd_title_register_reviewed', 'label' => 'Title register / plan reviewed'],
                    ['name' => 'dd_leasehold_terms_ok', 'label' => 'Leasehold terms acceptable'],
                    ['name' => 'dd_searches_considered', 'label' => 'Searches / planning constraints considered'],
                    ['name' => 'dd_insurance_buildings_considered', 'label' => 'Buildings insurance assumptions considered'],
                ]],
                ['name' => 'dd_checks_area', 'type' => 'checkbox_group', 'label' => 'Area and market', 'required' => false, 'items' => [
                    ['name' => 'dd_comparables_sold', 'label' => 'Comparable sold evidence reviewed'],
                    ['name' => 'dd_comparables_rent', 'label' => 'Comparable rental evidence reviewed'],
                    ['name' => 'dd_demand_supply', 'label' => 'Demand / supply reviewed'],
                    ['name' => 'dd_transport_amenities', 'label' => 'Transport / amenities noted'],
                ]],
                ['name' => 'dd_checks_property', 'type' => 'checkbox_group', 'label' => 'Property condition and compliance', 'required' => false, 'items' => [
                    ['name' => 'dd_epc_reviewed', 'label' => 'EPC reviewed'],
                    ['name' => 'dd_structural_inspection', 'label' => 'Viewing / inspection carried out'],
                    ['name' => 'dd_fire_safety_hmo', 'label' => 'Fire / HMO factors considered'],
                    ['name' => 'dd_planning_hmo_licence', 'label' => 'Planning / HMO licence checked'],
                ]],
                ['name' => 'dd_checks_financial', 'type' => 'checkbox_group', 'label' => 'Financial stack', 'required' => false, 'items' => [
                    ['name' => 'dd_numbers_stacked', 'label' => 'Purchase, refurb, GDV, rent numbers stacked'],
                    ['name' => 'dd_stress_test', 'label' => 'Stress test considered'],
                    ['name' => 'dd_stamp_legals_allowed', 'label' => 'Stamp, legals, fees allowed for'],
                    ['name' => 'dd_roi_yield_sanity', 'label' => 'ROI / yield sense-checked'],
                ]],
                ['name' => 'purchase_price_gbp', 'type' => 'text', 'label' => 'Purchase / offer price GBP', 'required' => false],
                ['name' => 'refurb_budget_gbp', 'type' => 'text', 'label' => 'Refurb budget GBP', 'required' => false],
                ['name' => 'gdv_gbp', 'type' => 'text', 'label' => 'GDV / exit value GBP', 'required' => false],
                ['name' => 'rent_pcm_gbp', 'type' => 'text', 'label' => 'Expected rent per month GBP', 'required' => false],
                ['name' => 'yield_roi_notes', 'type' => 'textarea', 'label' => 'Yield / ROI working', 'required' => false],
                ['name' => 'risks_and_concerns', 'type' => 'textarea', 'label' => 'Risks and concerns', 'required' => false],
                ['name' => 'assumptions', 'type' => 'textarea', 'label' => 'Key assumptions', 'required' => false],
                ['name' => 'recommendation', 'type' => 'select', 'label' => 'Recommendation', 'required' => false, 'options' => ['proceed' => 'Proceed', 'renegotiate' => 'Renegotiate', 'watch' => 'Watch', 'walk' => 'Walk away', 'other' => 'Other']],
                ['name' => 'supporting_documents_note', 'type' => 'textarea', 'label' => 'Supporting documents location', 'required' => false],
            ],
        ],
    ],
];
