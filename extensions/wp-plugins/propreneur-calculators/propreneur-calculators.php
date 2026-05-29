<?php

/**
 * Plugin Name: Propreneur Calculators
 * Plugin URI: https://propreneur.uk
 * Description: Embed all 27 Propreneur / Propcalc property calculators on any WordPress page via shortcode. Engine runs on Propreneur; your site displays the UI.
 * Version: 1.0.1
 * Author: VERLOX Ltd
 * Author URI: https://propreneur.uk
 * License: GPL-2.0-or-later
 * Text Domain: propreneur-calculators
 * Requires at least: 6.0
 * Requires PHP: 8.0
 */

declare(strict_types=1);

if (! defined('ABSPATH')) {
    exit;
}

define('PROPRENEUR_CALCULATORS_VERSION', '1.0.1');
define('PROPRENEUR_CALCULATORS_FILE', __FILE__);
define('PROPRENEUR_CALCULATORS_DIR', plugin_dir_path(__FILE__));
define('PROPRENEUR_CALCULATORS_URL', plugin_dir_url(__FILE__));

require_once PROPRENEUR_CALCULATORS_DIR.'includes/class-propreneur-calculators-settings.php';
require_once PROPRENEUR_CALCULATORS_DIR.'includes/class-propreneur-calculators-api.php';
require_once PROPRENEUR_CALCULATORS_DIR.'includes/class-propreneur-calculators-shortcodes.php';
require_once PROPRENEUR_CALCULATORS_DIR.'includes/class-propreneur-calculators.php';

add_action('plugins_loaded', static function (): void {
    Propreneur_Calculators_Settings::init();
    Propreneur_Calculators::init();
});

register_activation_hook(__FILE__, static function (): void {
    if (Propreneur_Calculators_Settings::get('api_base_url') === '') {
        Propreneur_Calculators_Settings::update([
            'api_base_url' => 'https://propreneur.uk',
            'default_slug' => 'strategy_finder',
            'iframe_height' => '880',
            'cache_minutes' => '60',
        ]);
    }
});
