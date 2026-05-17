<?php

declare(strict_types=1);

/**
 * Generates config/carina_module_tools.php from the canonical tool list.
 * Run: php scripts/build_carina_module_tools.php
 */
$tools = [
    // Accounting (12)
    ['create_journal_entry', 'Draft a balanced journal entry (debits and credits).', 'accounting_write', false, ['entry_date' => 'string', 'description' => 'string', 'lines' => 'array'], ['entry_date', 'lines']],
    ['create_expense', 'Log an operational expense with amount and category.', 'accounting_write', false, ['description' => 'string', 'category' => 'string', 'amount_gbp' => 'number', 'expense_date' => 'string', 'property_id' => 'integer'], ['description', 'category', 'amount_gbp', 'expense_date']],
    ['create_bank_transaction', 'Record a bank transaction against the workspace ledger.', 'accounting_write', false, ['transaction_date' => 'string', 'description' => 'string', 'amount_gbp' => 'number', 'type' => 'string'], ['transaction_date', 'description', 'amount_gbp', 'type']],
    ['reconcile_bank', 'Match bank transactions to journal entries.', 'accounting_write', true, ['bank_transaction_ids' => 'array', 'journal_entry_ids' => 'array'], ['bank_transaction_ids']],
    ['run_balance_sheet', 'Generate a balance sheet report as at a date.', 'accounting_read', false, ['as_at_date' => 'string'], ['as_at_date']],
    ['run_profit_and_loss', 'Generate profit and loss for workspace or a property.', 'accounting_read', false, ['from_date' => 'string', 'to_date' => 'string', 'property_id' => 'integer'], ['from_date', 'to_date']],
    ['run_trial_balance', 'Generate a trial balance for a period.', 'accounting_read', false, ['from_date' => 'string', 'to_date' => 'string'], ['from_date', 'to_date']],
    ['export_to_accounting', 'Push accounting data to an external system (Zoho, Xero, Sage, FreeAgent, QuickBooks).', 'accounting_write', true, ['provider' => 'string', 'from_date' => 'string', 'to_date' => 'string'], ['provider']],
    ['import_bank_csv', 'Parse bank CSV content into transactions.', 'accounting_write', false, ['csv_content' => 'string', 'account_name' => 'string'], ['csv_content']],
    ['get_account_activity', 'View GL account transactions for an account.', 'accounting_read', false, ['gl_account_id' => 'integer', 'limit' => 'integer'], ['gl_account_id']],
    ['create_gl_account', 'Add a chart of accounts entry.', 'accounting_write', false, ['code' => 'string', 'name' => 'string', 'type' => 'string'], ['code', 'name', 'type']],
    ['get_invoice', 'View a tenant invoice and its payment status.', 'accounting_read', false, ['invoice_id' => 'integer'], ['invoice_id']],
    // CRM (5)
    ['get_contact_timeline', 'Show interactions, deals, and communications for a contact.', 'crm_read', false, ['contact_id' => 'integer', 'limit' => 'integer'], ['contact_id']],
    ['merge_contacts', 'Merge duplicate contacts into a primary record.', 'crm', true, ['primary_contact_id' => 'integer', 'duplicate_contact_ids' => 'array'], ['primary_contact_id', 'duplicate_contact_ids']],
    ['import_contacts_csv', 'Bulk import contacts from CSV text content.', 'crm', true, ['csv_content' => 'string'], ['csv_content']],
    ['add_contact_interaction', 'Log a call, email, or meeting against a contact.', 'crm', false, ['contact_id' => 'integer', 'type' => 'string', 'subject' => 'string', 'description' => 'string'], ['contact_id', 'type', 'subject']],
    ['get_contact_investor_score', 'View investor scoring breakdown for a contact.', 'crm_read', false, ['contact_id' => 'integer'], ['contact_id']],
    // Deals (6)
    ['create_deal_analysis', 'Save a new deal analysis with strategy and metrics.', 'deals_write', false, ['title' => 'string', 'strategy' => 'string', 'property_id' => 'integer', 'metrics' => 'object'], ['title', 'strategy']],
    ['update_deal_analysis', 'Edit a saved deal analysis.', 'deals_write', false, ['deal_analysis_id' => 'integer', 'title' => 'string', 'metrics' => 'object', 'status' => 'string'], ['deal_analysis_id']],
    ['add_deal_refurb_line', 'Add a refurbishment line item to a deal.', 'deals_write', false, ['deal_analysis_id' => 'integer', 'description' => 'string', 'cost_gbp' => 'number'], ['deal_analysis_id', 'description', 'cost_gbp']],
    ['add_deal_task', 'Create a task linked to a deal or pipeline card.', 'deals_write', false, ['title' => 'string', 'deal_analysis_id' => 'integer', 'pipeline_deal_id' => 'integer', 'due_at' => 'string'], ['title']],
    ['add_deal_alert', 'Set an alert or reminder on a deal.', 'deals_write', false, ['deal_analysis_id' => 'integer', 'alert_type' => 'string', 'message' => 'string'], ['deal_analysis_id', 'alert_type']],
    ['add_deal_offer', 'Record an offer made on a deal.', 'deals_write', false, ['deal_analysis_id' => 'integer', 'amount_gbp' => 'number', 'status' => 'string'], ['deal_analysis_id', 'amount_gbp']],
    // Pipeline (4)
    ['create_pipeline', 'Create a new sales or sourcing pipeline.', 'pipeline', false, ['name' => 'string', 'type' => 'string'], ['name']],
    ['create_pipeline_stage', 'Add a stage to a pipeline.', 'pipeline', false, ['pipeline_id' => 'integer', 'name' => 'string', 'position' => 'integer'], ['pipeline_id', 'name']],
    ['move_pipeline_card', 'Move a pipeline deal card to another stage.', 'pipeline', false, ['pipeline_deal_id' => 'integer', 'stage_id' => 'integer'], ['pipeline_deal_id', 'stage_id']],
    ['get_pipeline_activity', 'View activity log for a pipeline or deal card.', 'pipeline', false, ['pipeline_id' => 'integer', 'pipeline_deal_id' => 'integer', 'limit' => 'integer'], []],
    // Compliance (7)
    ['create_compliance_check', 'Run a compliance check against a property.', 'compliance', false, ['property_id' => 'integer', 'check_type' => 'string'], ['property_id', 'check_type']],
    ['add_compliance_requirement', 'Add a compliance obligation for a property.', 'compliance', false, ['property_id' => 'integer', 'title' => 'string', 'due_date' => 'string'], ['property_id', 'title']],
    ['upload_document', 'Upload a document to the vault (base64 content).', 'compliance', true, ['title' => 'string', 'category' => 'string', 'file_base64' => 'string', 'property_id' => 'integer'], ['title', 'category', 'file_base64']],
    ['check_aml_status', 'Check AML record status for a contact.', 'compliance', false, ['contact_id' => 'integer'], ['contact_id']],
    ['log_aml_training', 'Record AML training completion for a user.', 'compliance', false, ['user_id' => 'integer', 'completed_at' => 'string', 'provider' => 'string'], ['user_id', 'completed_at']],
    ['file_complaint', 'Create a complaint case.', 'compliance', true, ['subject' => 'string', 'description' => 'string', 'contact_id' => 'integer'], ['subject', 'description']],
    ['get_regulatory_profile', 'View regulatory profile summary for the workspace.', 'compliance', false, [], []],
    // Mentoring (6)
    ['list_mentorship_programmes', 'List available mentorship programmes.', 'mentoring', false, ['query' => 'string'], []],
    ['match_mentor', 'Find a compatible mentor for criteria.', 'mentoring', false, ['mentee_user_id' => 'integer', 'programme_id' => 'integer'], ['mentee_user_id']],
    ['view_mentee_progress', 'Show mentee goals, milestones, and session notes.', 'mentoring', false, ['mentee_user_id' => 'integer', 'relationship_id' => 'integer'], ['mentee_user_id']],
    ['create_mentorship_goal', 'Set a goal for a mentee.', 'mentoring', false, ['relationship_id' => 'integer', 'title' => 'string', 'target_date' => 'string'], ['relationship_id', 'title']],
    ['log_mentorship_session', 'Record a mentorship session note.', 'mentoring', false, ['relationship_id' => 'integer', 'summary' => 'string', 'session_date' => 'string'], ['relationship_id', 'summary']],
    ['generate_mentorship_invoice', 'Create an invoice for mentorship billing.', 'mentoring', true, ['relationship_id' => 'integer', 'amount_gbp' => 'number'], ['relationship_id', 'amount_gbp']],
    // Community (5)
    ['list_courses', 'Search available courses.', 'community', false, ['query' => 'string', 'limit' => 'integer'], []],
    ['enrol_in_course', 'Enrol a user in a course.', 'community', false, ['course_id' => 'integer', 'user_id' => 'integer'], ['course_id', 'user_id']],
    ['start_quiz', 'Begin a course quiz or assessment.', 'community', false, ['quiz_id' => 'integer', 'user_id' => 'integer'], ['quiz_id', 'user_id']],
    ['create_community_post', 'Publish a post to the community feed.', 'community', false, ['title' => 'string', 'body' => 'string', 'group_id' => 'integer'], ['body']],
    ['find_groups', 'Search community groups by topic or location.', 'community', false, ['query' => 'string'], []],
    // Investor (3)
    ['share_deal_with_investor', 'Share a deal pack with an external investor contact.', 'investor', true, ['deal_analysis_id' => 'integer', 'contact_id' => 'integer'], ['deal_analysis_id', 'contact_id']],
    ['invite_investor', 'Send an investor portal invitation.', 'investor', true, ['email' => 'string', 'name' => 'string'], ['email']],
    ['get_investor_matches', 'Find deals matching investor criteria.', 'investor', false, ['contact_id' => 'integer', 'limit' => 'integer'], ['contact_id']],
    // Sourcing (4)
    ['create_sourcing_criterion', 'Set deal-finding criteria (location, price, yield).', 'sourcing', false, ['name' => 'string', 'criteria' => 'object'], ['name', 'criteria']],
    ['find_matching_listings', 'Search listings against sourcing criteria.', 'sourcing', false, ['criterion_id' => 'integer', 'limit' => 'integer'], []],
    ['set_up_listing_watch', 'Automate monitoring of new listings matching criteria.', 'sourcing', false, ['criterion_id' => 'integer', 'active' => 'boolean'], ['criterion_id']],
    ['get_sourcing_research_links', 'View saved research links for due diligence.', 'sourcing', false, ['deal_analysis_id' => 'integer', 'property_id' => 'integer'], []],
    // Lead funnel (5)
    ['list_inbound_leads', 'View captured leads from social platforms.', 'lead_funnel', false, ['status' => 'string', 'limit' => 'integer'], []],
    ['get_campaign_performance', 'Show ad campaign stats (impressions, clicks, leads, spend).', 'lead_funnel', false, ['campaign_id' => 'integer'], []],
    ['create_ad_campaign', 'Set up a new Meta, LinkedIn, or TikTok campaign.', 'lead_funnel', true, ['platform' => 'string', 'name' => 'string', 'budget_gbp' => 'number'], ['platform', 'name']],
    ['pause_ad_campaign', 'Pause an active ad campaign.', 'lead_funnel', true, ['campaign_id' => 'integer'], ['campaign_id']],
    ['get_lead_funnel_summary', 'Overview of lead sources and conversion rates.', 'lead_funnel', false, ['from_date' => 'string', 'to_date' => 'string'], []],
    // Works orders (3)
    ['create_works_order', 'Issue a works order for a property.', 'portfolio', false, ['property_id' => 'integer', 'title' => 'string', 'description' => 'string'], ['property_id', 'title']],
    ['approve_works_order_quote', 'Approve a quote on a works order.', 'portfolio', true, ['works_order_id' => 'integer', 'quote_id' => 'integer'], ['works_order_id', 'quote_id']],
    ['get_works_order_status', 'Track works order completion status.', 'portfolio', false, ['works_order_id' => 'integer'], ['works_order_id']],
    // Maintenance (4)
    ['register_property_asset', 'Register an asset (boiler, appliance) on a property.', 'portfolio', false, ['property_id' => 'integer', 'name' => 'string', 'asset_type' => 'string'], ['property_id', 'name']],
    ['schedule_maintenance', 'Schedule recurring or one-off maintenance.', 'portfolio', false, ['property_id' => 'integer', 'title' => 'string', 'due_at' => 'string'], ['property_id', 'title']],
    ['log_maintenance_record', 'Record completed maintenance work.', 'portfolio', false, ['property_id' => 'integer', 'description' => 'string', 'completed_at' => 'string'], ['property_id', 'description']],
    ['create_maintenance_request', 'Report a maintenance issue requiring attention.', 'portfolio', false, ['property_id' => 'integer', 'description' => 'string', 'priority' => 'string'], ['property_id', 'description']],
    // Staff (3)
    ['create_staff_profile', 'Add a team member staff profile.', 'staff', false, ['name' => 'string', 'email' => 'string', 'role' => 'string'], ['name', 'email']],
    ['run_payroll', 'Generate payroll for a pay period.', 'staff', true, ['period_start' => 'string', 'period_end' => 'string'], ['period_start', 'period_end']],
    ['approve_leave_request', 'Approve or decline a staff leave request.', 'staff', false, ['leave_request_id' => 'integer', 'decision' => 'string'], ['leave_request_id', 'decision']],
    // Invoicing (2)
    ['create_invoice', 'Generate a tenant-facing invoice.', 'accounting_write', false, ['contact_id' => 'integer', 'amount_gbp' => 'number', 'description' => 'string', 'due_date' => 'string'], ['amount_gbp', 'description']],
    ['record_payment', 'Record payment against an invoice.', 'accounting_write', false, ['invoice_id' => 'integer', 'amount_gbp' => 'number', 'paid_at' => 'string'], ['invoice_id', 'amount_gbp']],
    // Billing (2)
    ['get_subscription_usage', 'Show current plan usage and limits.', 'billing', false, [], []],
    ['upgrade_subscription', 'Change workspace billing plan.', 'billing', true, ['plan_slug' => 'string'], ['plan_slug']],
    // Backup & security (2)
    ['run_backup', 'Trigger a workspace or platform backup job.', 'platform_admin', true, ['scope' => 'string'], []],
    ['generate_security_report', 'Summary of security findings (SCOUT).', 'platform_admin', false, ['days' => 'integer'], []],
];

$typeMap = [
    'string' => ['type' => 'string'],
    'number' => ['type' => 'number'],
    'integer' => ['type' => 'integer'],
    'boolean' => ['type' => 'boolean'],
    'array' => ['type' => 'array', 'items' => ['type' => 'string']],
    'object' => ['type' => 'object', 'additionalProperties' => true],
];

$out = [];
foreach ($tools as [$name, $desc, $gate, $confirm, $props, $required]) {
    $properties = [];
    foreach ($props as $key => $type) {
        $properties[$key] = array_merge(['description' => str_replace('_', ' ', $key)], $typeMap[$type] ?? ['type' => 'string']);
    }
    $schema = ['type' => 'object', 'properties' => $properties];
    if ($required !== []) {
        $schema['required'] = $required;
    }
    $out[] = [
        'name' => $name,
        'description' => $desc,
        'gate' => $gate,
        'confirm' => $confirm,
        'schema' => $schema,
    ];
}

$export = var_export($out, true);
$php = "<?php\n\ndeclare(strict_types=1);\n\n/** Auto-generated by scripts/build_carina_module_tools.php — do not edit by hand. */\nreturn {$export};\n";
$path = __DIR__.'/../config/carina_module_tools.php';
file_put_contents($path, $php);
echo 'Wrote '.count($out)." tools to {$path}\n";
