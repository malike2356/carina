<?php

/**
 * Plugin Name: Propreneur Lead Ingest
 * Plugin URI: https://propreneur.uk
 * Description: Send WordPress form submissions (Kadence, CF7, WPForms, Fluent Forms, Elementor Pro) to your Propreneur CRM contacts.
 * Version: 2.2.0
 * Author: VERLOX Ltd
 * Author URI: https://propreneur.uk
 * License: GPL-2.0-or-later
 * Text Domain: propreneur-lead-ingest
 * Requires at least: 6.0
 * Requires PHP: 8.0
 */

declare(strict_types=1);

if (! defined('ABSPATH')) {
    exit;
}

define('PROPRENEUR_LEAD_INGEST_VERSION', '2.2.0');
define('PROPRENEUR_LEAD_INGEST_FILE', __FILE__);
define('PROPRENEUR_LEAD_INGEST_DIR', plugin_dir_path(__FILE__));

require_once PROPRENEUR_LEAD_INGEST_DIR.'includes/class-propreneur-lead-ingest-settings.php';
require_once PROPRENEUR_LEAD_INGEST_DIR.'includes/class-propreneur-lead-ingest-field-mapper.php';
require_once PROPRENEUR_LEAD_INGEST_DIR.'includes/class-propreneur-lead-ingest-client.php';
require_once PROPRENEUR_LEAD_INGEST_DIR.'includes/class-propreneur-lead-ingest-kadence.php';
require_once PROPRENEUR_LEAD_INGEST_DIR.'includes/class-propreneur-lead-ingest-cf7.php';
require_once PROPRENEUR_LEAD_INGEST_DIR.'includes/class-propreneur-lead-ingest-wpforms.php';
require_once PROPRENEUR_LEAD_INGEST_DIR.'includes/class-propreneur-lead-ingest-fluentforms.php';
require_once PROPRENEUR_LEAD_INGEST_DIR.'includes/class-propreneur-lead-ingest-elementor.php';
require_once PROPRENEUR_LEAD_INGEST_DIR.'includes/class-propreneur-lead-ingest.php';

/**
 * @return array<string, mixed>
 */
function propreneur_lead_ingest_settings(): array
{
    return Propreneur_Lead_Ingest_Settings::get();
}

add_action('plugins_loaded', static function (): void {
    Propreneur_Lead_Ingest_Settings::init();
    Propreneur_Lead_Ingest::init();
});

register_activation_hook(__FILE__, static function (): void {
    if (Propreneur_Lead_Ingest_Settings::get('tenant_slug') === '') {
        Propreneur_Lead_Ingest_Settings::update([
            'tenant_slug' => '',
            'ingest_url' => 'https://propreneur.uk/api/leads/ingest',
            'form_mode' => 'all',
            'form_ids' => '',
            'log_debug' => '0',
            'enable_kadence' => '1',
            'enable_cf7' => '1',
            'enable_wpforms' => '1',
            'enable_fluentforms' => '1',
            'enable_elementor' => '1',
        ]);
    }
});
