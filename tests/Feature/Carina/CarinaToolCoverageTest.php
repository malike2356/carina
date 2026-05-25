<?php

declare(strict_types=1);

use App\Services\Carina\CarinaToolRegistry;
use App\Services\Carina\Tools\Btl\DraftSection21Tool;
use App\Services\Carina\Tools\CreatePropertyTool;

it('registers every prompt 223 tool in the Carina registry', function (): void {
    $registry = app(CarinaToolRegistry::class);
    $names = array_map(fn ($t) => $t->name(), $registry->all());

    $expected = [
        // Phase A - property writes
        'create_property',
        'update_property',
        // Phase B - tenancy domain
        'list_tenancies',
        'get_tenancy',
        'create_tenancy',
        'update_tenancy',
        'end_tenancy',
        'get_rent_arrears',
        // Phase C - document vault
        'list_documents',
        'get_document_versions',
        'get_document_download_url',
        'archive_document',
        // Phase D - comms management
        'list_communication_sequences',
        'get_sequence_enrollment_status',
        'pause_enrollment',
        'get_sequence_stats',
        // Phase E - reporting
        'get_portfolio_overview',
        'get_revenue_by_property',
        'get_compliance_dashboard_stats',
        // Phase F - project writes
        'create_project',
        'update_project_status',
        'add_project_task',
        'update_task',
        // Phase G - vcal booking management
        'list_bookings',
        'cancel_booking',
        'reschedule_booking',
        // Phase H - BTL
        'draft_section_21',
        'list_renewals_due',
        // Phase I - Lodge
        'get_sa_revenue_summary',
        'list_upcoming_sa_bookings',
        // Phase J - Steward
        'get_service_charge_summary',
        'list_leaseholders',
        // Phase K - Agency
        'list_managed_properties',
        'get_landlord_statement',
        // Phase L - Bridge / R2R
        'get_r2r_margin_analysis',
        'list_r2r_agreements',
        // Phase M - Hall / student lettings
        'get_guarantor_status',
        'get_summer_void_forecast',
        // Phase N - mentoring extensions
        'list_cohort_members',
        'update_mentorship_goal',
        'check_certificate_status',
        // Phase O - minor list tools
        'list_deal_analyses',
        'list_contacts',
    ];

    $missing = array_values(array_diff($expected, $names));
    expect($missing)->toBe([], 'Missing Carina tools: '.implode(', ', $missing));
});

it('create_property requires confirmation', function (): void {
    expect(app(CreatePropertyTool::class)->requiresConfirmation())->toBeTrue();
});

it('draft_section_21 requires confirmation', function (): void {
    expect(app(DraftSection21Tool::class)->requiresConfirmation())->toBeTrue();
});

it('every prompt 223 tool exposes a non-empty description and a valid input schema', function (): void {
    $registry = app(CarinaToolRegistry::class);
    $byName = [];
    foreach ($registry->all() as $tool) {
        $byName[$tool->name()] = $tool;
    }

    $newTools = [
        'create_property', 'update_property',
        'list_tenancies', 'get_tenancy', 'create_tenancy', 'update_tenancy', 'end_tenancy', 'get_rent_arrears',
        'list_documents', 'get_document_versions', 'get_document_download_url', 'archive_document',
        'list_communication_sequences', 'get_sequence_enrollment_status', 'pause_enrollment', 'get_sequence_stats',
        'get_portfolio_overview', 'get_revenue_by_property', 'get_compliance_dashboard_stats',
        'create_project', 'update_project_status', 'add_project_task', 'update_task',
        'list_bookings', 'cancel_booking', 'reschedule_booking',
        'draft_section_21', 'list_renewals_due',
        'get_sa_revenue_summary', 'list_upcoming_sa_bookings',
        'get_service_charge_summary', 'list_leaseholders',
        'list_managed_properties', 'get_landlord_statement',
        'get_r2r_margin_analysis', 'list_r2r_agreements',
        'get_guarantor_status', 'get_summer_void_forecast',
        'list_cohort_members', 'update_mentorship_goal', 'check_certificate_status',
        'list_deal_analyses', 'list_contacts',
    ];

    foreach ($newTools as $name) {
        expect(array_key_exists($name, $byName))->toBeTrue();
        $tool = $byName[$name];
        $desc = $tool->description();
        expect($desc)->toBeString();
        expect(strlen($desc))->toBeGreaterThan(0);
        $schema = $tool->inputSchema();
        expect($schema)->toBeArray();
        expect(array_key_exists('type', $schema))->toBeTrue();
        expect($schema['type'])->toBe('object');
    }
});
