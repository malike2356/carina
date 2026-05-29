<?php

declare(strict_types=1);

if (! defined('ABSPATH')) {
    exit;
}

final class Propreneur_Lead_Ingest
{
    public static function init(): void
    {
        Propreneur_Lead_Ingest_Kadence::init();

        if (self::plugin_active('contact-form-7/wp-contact-form-7.php') || class_exists('WPCF7')) {
            Propreneur_Lead_Ingest_Cf7::init();
        }

        if (self::plugin_active('wpforms-lite/wpforms.php') || self::plugin_active('wpforms/wpforms.php') || function_exists('wpforms')) {
            Propreneur_Lead_Ingest_Wpforms::init();
        }

        if (self::plugin_active('fluentform/fluentform.php') || defined('FLUENTFORM')) {
            Propreneur_Lead_Ingest_Fluentforms::init();
        }

        if (self::elementor_pro_available()) {
            Propreneur_Lead_Ingest_Elementor::init();
        }
    }

    private static function plugin_active(string $plugin): bool
    {
        if (! function_exists('is_plugin_active')) {
            require_once ABSPATH.'wp-admin/includes/plugin.php';
        }

        return is_plugin_active($plugin);
    }

    private static function elementor_pro_available(): bool
    {
        return self::plugin_active('elementor-pro/elementor-pro.php')
            || class_exists('\ElementorPro\Plugin');
    }
}
