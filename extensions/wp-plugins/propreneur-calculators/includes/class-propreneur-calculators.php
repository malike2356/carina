<?php

declare(strict_types=1);

if (! defined('ABSPATH')) {
    exit;
}

final class Propreneur_Calculators
{
    public static function init(): void
    {
        Propreneur_Calculators_Shortcodes::register();
        add_action('wp_enqueue_scripts', [self::class, 'enqueue_assets']);
    }

    public static function enqueue_assets(): void
    {
        if (! self::page_has_shortcode()) {
            return;
        }

        wp_enqueue_style(
            'propreneur-calculators',
            PROPRENEUR_CALCULATORS_URL.'assets/css/hub.css',
            [],
            PROPRENEUR_CALCULATORS_VERSION,
        );

        wp_enqueue_script(
            'propreneur-calculators',
            PROPRENEUR_CALCULATORS_URL.'assets/js/hub.js',
            [],
            PROPRENEUR_CALCULATORS_VERSION,
            true,
        );
    }

    private static function page_has_shortcode(): bool
    {
        if (! is_singular()) {
            return false;
        }

        $post = get_post();
        if (! $post instanceof WP_Post) {
            return false;
        }

        return has_shortcode($post->post_content, 'propreneur_calculators')
            || has_shortcode($post->post_content, 'propreneur_calculator');
    }
}
