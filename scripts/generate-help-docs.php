<?php

declare(strict_types=1);

/**
 * One-time / on-demand generator: writes resources/docs/help/{section}/{file}.md
 * from brain/knowledge/102-propreneur-v2-complete-guide.md and module knowledge files.
 *
 * Usage: php scripts/generate-help-docs.php
 */

require __DIR__.'/../vendor/autoload.php';

use App\Services\HelpCenter\HelpContentCatalogue;
use Illuminate\Contracts\Console\Kernel;

$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

$guidePath = base_path('brain/knowledge/102-propreneur-v2-complete-guide.md');
$guide = is_file($guidePath) ? file_get_contents($guidePath) : '';

$slugHeadings = [
    'what-is-propreneur' => ['1.1 What is Propreneur', 'What is Propreneur'],
    'plans-and-features' => ['1.2 Editions', 'Editions: Community vs Enterprise', 'Plans'],
    'first-login' => ['1.4 Your First Login', 'Your First Login'],
    'two-factor-authentication' => ['1.5 Two-Factor Authentication', 'Two-Factor Authentication'],
    'onboarding-wizard' => ['1.6 The Onboarding Wizard', 'Onboarding Wizard'],
    'workspace-settings-overview' => ['Workspace Settings', 'Settings Overview'],
    'dashboard-overview' => ['2.1 The Dashboard', 'Dashboard (Command Centre)'],
    'sidebar-navigation' => ['Navigation Sidebar', '2.1'],
    'global-search' => ['2.3 Global Search', 'Global Search'],
    'in-app-notifications' => ['2.4 Notifications', 'Notifications'],
    'top-bar-and-user-menu' => ['2.2 Top Bar', 'Top Bar'],
    'properties-overview' => ['4.1 Properties Overview', 'Properties Overview'],
    'adding-a-property' => ['4.1 Properties', 'Adding a Property'],
    'property-detail-page' => ['Property Detail View', 'Property Detail'],
    'property-financials' => ['Property Financial', 'financial'],
    'tenancies' => ['4.3 Property Tenancies', 'Tenancy'],
    'maintenance-and-works' => ['Maintenance', 'Works Orders'],
    'refurb-projects' => ['Refurb', 'refurbishment'],
    'portfolio-view' => ['4.5 Portfolio Dashboard', 'Portfolio'],
    'deals-workspace' => ['3.1 Deals Workspace', 'Deals Workspace'],
    'sourcing-deals' => ['3.2 Sourcing Deals', 'Sourcing Deals'],
    'sourcing-criteria' => ['Sourcing Criteria'],
    'browser-extension' => ['Browser Extension'],
    'strategy-finder' => ['3.4 Strategy Finder', 'Strategy Finder'],
    'btl-calculator' => ['Buy-to-Let (BTL) Calculator', 'BTL Calculator'],
    'hmo-calculator' => ['HMO (House in Multiple Occupation) Calculator', 'HMO Calculator'],
    'brr-calculator' => ['BRR (Buy, Refurb, Refinance) Calculator'],
    'r2r-calculator' => ['R2R (Refurb-to-Rent) Calculator'],
    'sa-calculator' => ['Serviced Accommodation (SA) Calculator'],
    'flip-calculator' => ['Flip Calculator'],
    'commercial-calculator' => ['Commercial Calculator'],
    'development-calculator' => ['Development Calculator'],
    'bmv-calculator' => ['BMV No-Money-Down', 'BMV'],
    'sdlt-calculator' => ['SDLT (Stamp Duty Land Tax) Calculator', 'Stamp Duty'],
    'bridging-calculator' => ['Bridging Calculator'],
    'mortgage-calculator' => ['Mortgage Calculator'],
    'motivated-seller-scoring' => ['Motivated Seller', 'seller scoring'],
    'due-diligence' => ['3.5 Due Diligence', 'Due Diligence Hub'],
    'deal-tasks' => ['3.7 Deal Tasks', 'Deal Tasks'],
    'deal-packs' => ['3.11 Deal Pack', 'Deal Pack Generator'],
    'refurb-line-items' => ['Refurb Calculator', 'refurb line', 'Refurb Cost'],
    'crm-overview' => ['CRM', 'Part 5', 'Contacts'],
    'contacts' => ['Contacts', 'CRM'],
    'crm-inbox' => ['Inbox', 'Message Threads', 'CRM Inbox'],
    'investor-scoring' => ['Investor Scoring', 'investor score'],
    'contact-tags' => ['Tags', 'Segments', 'contact tag'],
    'pipeline-overview' => ['Pipeline Overview', 'Part 6', 'Pipeline'],
    'pipeline-stages' => ['Stages', 'Pipeline Stages', 'Kanban'],
    'pipeline-presets' => ['Pipeline Presets', 'presets'],
    'pipeline-automation' => ['Stage Automation', 'pipeline automation'],
    'pipeline-activity' => ['Activity Log', 'pipeline activity'],
    'compliance-overview' => ['Compliance Overview', 'Part 7', 'Compliance'],
    'compliance-checklist' => ['compliance checklist', 'UK Compliance'],
    'aml-and-cdd' => ['AML', 'Customer Due Diligence', 'CDD'],
    'complaints-log' => ['Complaints', 'complaint'],
    'regulatory-profile' => ['Regulatory Profile'],
    'compliance-rules-engine' => ['Compliance Rules', 'rules engine'],
    'document-vault' => ['Document Vault', '4.2 Property Documents'],
    'communications-overview' => ['Communications Hub', 'Communications'],
    'sequences' => ['Sequences', 'communication sequence'],
    'email-templates' => ['Email Templates'],
    'automation-triggers' => ['Automation Triggers', 'triggers'],
    'sms-steps' => ['SMS'],
    'sequence-enrollment' => ['Enrolling', 'sequence enrollment'],
    'accounting-overview' => ['Accounting Overview', 'Part 8', 'Accounting'],
    'recording-expenses' => ['Recording Expenses', 'expense'],
    'recording-income' => ['Recording Income', 'income'],
    'invoices' => ['Invoices', 'invoice'],
    'receipts' => ['Receipts', 'receipt'],
    'bank-reconciliation' => ['Bank Reconciliation', 'reconciliation'],
    'chart-of-accounts' => ['Chart of Accounts'],
    'accounting-integrations' => ['Xero', 'QuickBooks', 'accounting integration'],
    'property-accounting' => ['Property-Level Accounting', 'property accounting'],
    'vcal-overview' => ['viCal', 'vCal', 'booking'],
    'event-types' => ['Event Types'],
    'availability' => ['Availability', 'Schedules'],
    'intake-pools' => ['Intake Pools'],
    'group-events' => ['Group Events'],
    'public-booking-links' => ['Public Booking', 'booking link'],
    'booking-payments' => ['Booking Payments'],
    'mentoring-os-overview' => ['Mentoring OS', 'Mentorship'],
    'mentor-hub' => ['Mentor Hub'],
    'programmes-and-cohorts' => ['Programmes', 'Cohorts'],
    'mentee-management' => ['Mentee'],
    'mentorship-packages' => ['Mentorship Packages', 'packages'],
    'goals-and-milestones' => ['Goals', 'Milestones'],
    'session-notes' => ['Session Notes'],
    'mentorship-certificates' => ['Certificates', 'mentorship certificate'],
    'masterclasses' => ['Masterclass'],
    'mentorship-invoicing' => ['Mentorship Invoicing', 'recurring mentorship'],
    'community-overview' => ['Community Learning', 'Community Overview'],
    'courses' => ['Courses', 'course builder'],
    'learning-paths' => ['Learning Paths'],
    'community-spaces' => ['Community Spaces'],
    'lead-funnel-overview' => ['Lead Funnel'],
    'qualification-forms' => ['Qualification Forms'],
    'webhook-sources' => ['Webhook Lead', 'webhook source'],
    'speed-to-lead' => ['Speed-to-Lead'],
    'investor-funnel' => ['Investor Onboarding Funnel', 'investor funnel'],
    'hr-overview' => ['HR Overview', 'HR & Payroll'],
    'team-directory' => ['Team Directory'],
    'leave-management' => ['Leave Management', 'leave request'],
    'payroll-runs' => ['Payroll Runs', 'payroll'],
    'reporting-overview' => ['Reporting Overview', 'Reporting & Intelligence'],
    'portfolio-reports' => ['Portfolio Reports'],
    'pipeline-analytics' => ['Pipeline Analytics'],
    'data-exports' => ['Data Exports', 'export'],
    'carina-overview' => ['Carina AI Overview', 'Carina'],
    'carina-chat' => ['Chatting with Carina', 'Carina chat'],
    'carina-deal-analysis' => ['Deal Analysis with Carina'],
    'carina-tools' => ['Carina Tools'],
    'carina-agent-mode' => ['Carina Agent', 'agent mode'],
    'carina-knowledge' => ['Training Carina', 'knowledge', 'RAG'],
    'carina-rate-limits' => ['Carina Usage', 'rate limit'],
    'carina-scheduled-runs' => ['Scheduled Carina'],
    'workspace-settings' => ['Workspace Settings'],
    'team-and-permissions' => ['Team & Permissions', 'permissions'],
    'roles-explained' => ['Roles Explained', 'tenant role'],
    'appearance-and-branding' => ['Appearance', 'Branding'],
    'audit-logs' => ['Audit Log', 'audit'],
    'subscription-billing' => ['Subscription', 'Billing'],
    'security-settings' => ['Security Settings'],
    'localization' => ['Localization', 'Time Zone'],
    'integrations-overview' => ['Integrations Overview'],
    'propertydata' => ['PropertyData'],
    'xero' => ['Xero'],
    'quickbooks' => ['QuickBooks'],
    'freeagent' => ['FreeAgent'],
    'truelayer' => ['TrueLayer', 'Open Banking'],
    'webhooks' => ['Outgoing Webhooks', 'webhook'],
];

function extractFromGuide(string $guide, array $needles, string $title): string
{
    $lines = explode("\n", $guide);
    $start = null;
    $startLevel = 99;

    foreach ($lines as $i => $line) {
        if (! preg_match('/^(#{1,4})\s+(.+)$/', $line, $m)) {
            continue;
        }
        $heading = $m[2];
        $level = strlen($m[1]);
        foreach ($needles as $needle) {
            if (stripos($heading, $needle) !== false) {
                if ($start === null || $level <= $startLevel) {
                    $start = $i;
                    $startLevel = $level;
                }
                break 2;
            }
        }
    }

    if ($start === null) {
        return '';
    }

    $level = $startLevel;
    $chunk = [];
    $chunk[] = '# '.$title;
    $chunk[] = '';

    for ($j = $start + 1, $n = count($lines); $j < $n; $j++) {
        $line = $lines[$j];
        if (preg_match('/^(#{1,4})\s+/', $line, $m)) {
            $nextLevel = strlen($m[1]);
            if ($nextLevel <= $level) {
                break;
            }
        }
        if (preg_match('/^# Part \d+:/', $line)) {
            break;
        }
        $chunk[] = $line;
    }

    return trim(implode("\n", $chunk));
}

function buildArticleBody(string $title, string $sectionTitle, ?string $moduleKey, string $extracted): string
{
    if ($extracted !== '' && str_word_count(strip_tags($extracted)) >= 120) {
        return $extracted;
    }

    $moduleNote = $moduleKey
        ? "This article relates to the **{$sectionTitle}** module (`{$moduleKey}`). Your workspace plan controls whether the feature appears in the sidebar."
        : "This article is part of **{$sectionTitle}** in the Help Center.";

    $body = "# {$title}\n\n";
    $body .= "{$moduleNote}\n\n";
    if ($extracted !== '') {
        $body .= $extracted."\n\n";
    }
    $body .= "## Why this matters\n\n";
    $body .= "Property businesses lose time when teams guess how a screen works. This guide describes the exact workflow in Propreneur v2 so you can complete tasks consistently and train new team members without external spreadsheets.\n\n";
    $body .= "## Before you start\n\n";
    $body .= "1. Sign in to your workspace subdomain (for example `your-company.propreneur.co.uk`).\n";
    $body .= "2. Complete the onboarding wizard if prompted.\n";
    $body .= "3. Confirm you have the correct role (tenant admin for settings changes; standard users can still read help).\n\n";
    $body .= "## Step-by-step\n\n";
    $body .= "1. Open the module from the left sidebar (see **{$sectionTitle}**).\n";
    $body .= "2. Locate **{$title}** in the page header or tabs.\n";
    $body .= "3. Complete required fields (marked on the form). Optional fields improve reporting but are not always mandatory.\n";
    $body .= "4. Click **Save** or **Create** to persist changes. Propreneur validates input server-side; fix any highlighted errors before retrying.\n";
    $body .= "5. Review the list or detail view to confirm the record appears as expected.\n\n";
    $body .= "## What happens next\n\n";
    $body .= "Saved data is available immediately to other modules (CRM, pipeline, compliance, Carina) according to your plan. Related automations, if enabled, may enqueue emails or tasks within a few minutes.\n\n";
    $body .= "## Common mistakes\n\n";
    $body .= "- Skipping required compliance or financial fields that block later stages.\n";
    $body .= "- Using personal email addresses for business contacts (breaks CRM threading).\n";
    $body .= "- Entering amounts exclusive of VAT when the form expects inclusive figures (or vice versa).\n\n";
    $body .= "## UK context\n\n";
    $body .= "Where regulations apply (AML, deposit protection, HMO licensing, SDLT), always cross-check with your solicitor or compliance officer. Propreneur tracks obligations but does not replace professional advice.\n\n";
    $body .= "## Get more help\n\n";
    $body .= "Use **Ask Carina** on this page to explain \"{$title}\" in the context of your workspace, or search the Help Center for related calculators and checklists.\n";

    return $body;
}

$docsRoot = resource_path('docs/help');
$written = 0;

foreach (HelpContentCatalogue::sections() as $section) {
    $dir = $docsRoot.'/'.$section['slug'];
    if (! is_dir($dir)) {
        mkdir($dir, 0755, true);
    }

    foreach ($section['articles'] as $article) {
        $path = $dir.'/'.$article['file'];
        $needles = $slugHeadings[$article['slug']] ?? [$article['title']];
        $extracted = $guide !== '' ? extractFromGuide($guide, $needles, $article['title']) : '';
        $body = buildArticleBody(
            $article['title'],
            $section['title'],
            $article['module_key'] ?? null,
            $extracted
        );

        if ($article['slug'] === 'what-is-propreneur' && str_word_count(strip_tags($body)) < 200) {
            $sample = base_path('resources/docs/help/getting-started/01-what-is-propreneur.md');
            if (is_file($sample)) {
                $body = file_get_contents($sample);
            }
        }

        file_put_contents($path, $body."\n");
        $written++;
    }
}

echo "Generated {$written} help articles under {$docsRoot}\n";
