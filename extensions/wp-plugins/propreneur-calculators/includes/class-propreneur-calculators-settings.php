<?php

declare(strict_types=1);

if (! defined('ABSPATH')) {
    exit;
}

final class Propreneur_Calculators_Settings
{
    private const OPTION_KEY = 'propreneur_calculators_settings';

    private const DEFAULTS = [
        'api_base_url' => 'https://propcalc.uk',
        'default_slug' => 'strategy_finder',
        'iframe_height' => '880',
        'cache_minutes' => '60',
    ];

    public static function init(): void
    {
        add_action('admin_menu', [self::class, 'register_menu']);
        add_action('admin_init', [self::class, 'register_settings']);
    }

    public static function register_menu(): void
    {
        add_options_page(
            __('Propreneur Calculators', 'propreneur-calculators'),
            __('Propreneur Calculators', 'propreneur-calculators'),
            'manage_options',
            'propreneur-calculators',
            [self::class, 'render_page'],
        );
    }

    public static function register_settings(): void
    {
        register_setting(
            'propreneur_calculators',
            self::OPTION_KEY,
            [
                'type' => 'array',
                'sanitize_callback' => [self::class, 'sanitize'],
                'default' => self::DEFAULTS,
            ],
        );
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, string>
     */
    public static function sanitize(array $input): array
    {
        $clean = self::DEFAULTS;

        $url = esc_url_raw((string) ($input['api_base_url'] ?? self::DEFAULTS['api_base_url']));
        $clean['api_base_url'] = $url !== '' ? untrailingslashit($url) : self::DEFAULTS['api_base_url'];

        $slug = sanitize_key((string) ($input['default_slug'] ?? self::DEFAULTS['default_slug']));
        $clean['default_slug'] = $slug !== '' ? $slug : self::DEFAULTS['default_slug'];

        $height = (int) ($input['iframe_height'] ?? 880);
        $clean['iframe_height'] = (string) max(400, min(2400, $height));

        $cache = (int) ($input['cache_minutes'] ?? 60);
        $clean['cache_minutes'] = (string) max(5, min(1440, $cache));

        return $clean;
    }

    /**
     * @return array<string, string>
     */
    public static function get(): array
    {
        $stored = get_option(self::OPTION_KEY, []);
        if (! is_array($stored)) {
            $stored = [];
        }

        return array_merge(self::DEFAULTS, array_intersect_key($stored, self::DEFAULTS));
    }

    /**
     * @param  array<string, string>  $values
     */
    public static function update(array $values): void
    {
        update_option(self::OPTION_KEY, self::sanitize($values));
    }

    public static function render_page(): void
    {
        if (! current_user_can('manage_options')) {
            return;
        }

        $settings = self::get();
        ?>
        <div class="wrap">
            <h1><?php echo esc_html__('Propreneur Calculators', 'propreneur-calculators'); ?></h1>
            <p><?php echo esc_html__('Calculators run on Propreneur / Propcalc via API. Use shortcodes on any page.', 'propreneur-calculators'); ?></p>

            <form method="post" action="options.php">
                <?php settings_fields('propreneur_calculators'); ?>
                <table class="form-table" role="presentation">
                    <tr>
                        <th scope="row"><label for="pc_api_base_url"><?php esc_html_e('API base URL', 'propreneur-calculators'); ?></label></th>
                        <td>
                            <input type="url" class="regular-text" id="pc_api_base_url" name="<?php echo esc_attr(self::OPTION_KEY); ?>[api_base_url]" value="<?php echo esc_attr($settings['api_base_url']); ?>">
                            <p class="description"><?php esc_html_e('Usually https://propcalc.uk (catalog at /calculators/catalog).', 'propreneur-calculators'); ?></p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="pc_default_slug"><?php esc_html_e('Default calculator', 'propreneur-calculators'); ?></label></th>
                        <td>
                            <input type="text" class="regular-text" id="pc_default_slug" name="<?php echo esc_attr(self::OPTION_KEY); ?>[default_slug]" value="<?php echo esc_attr($settings['default_slug']); ?>">
                            <p class="description"><?php esc_html_e('Slug shown first in the hub, e.g. strategy_finder or brr.', 'propreneur-calculators'); ?></p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="pc_iframe_height"><?php esc_html_e('Iframe height (px)', 'propreneur-calculators'); ?></label></th>
                        <td>
                            <input type="number" min="400" max="2400" id="pc_iframe_height" name="<?php echo esc_attr(self::OPTION_KEY); ?>[iframe_height]" value="<?php echo esc_attr($settings['iframe_height']); ?>">
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="pc_cache_minutes"><?php esc_html_e('Catalog cache (minutes)', 'propreneur-calculators'); ?></label></th>
                        <td>
                            <input type="number" min="5" max="1440" id="pc_cache_minutes" name="<?php echo esc_attr(self::OPTION_KEY); ?>[cache_minutes]" value="<?php echo esc_attr($settings['cache_minutes']); ?>">
                        </td>
                    </tr>
                </table>
                <?php submit_button(); ?>
            </form>

            <h2><?php esc_html_e('Shortcodes', 'propreneur-calculators'); ?></h2>
            <table class="widefat striped" style="max-width:720px">
                <thead><tr><th>Shortcode</th><th>Description</th></tr></thead>
                <tbody>
                    <tr><td><code>[propreneur_calculators]</code></td><td><?php esc_html_e('Full hub: all 27 calculators with sidebar picker + iframe.', 'propreneur-calculators'); ?></td></tr>
                    <tr><td><code>[propreneur_calculator slug="brr"]</code></td><td><?php esc_html_e('Single calculator embed.', 'propreneur-calculators'); ?></td></tr>
                </tbody>
            </table>
        </div>
        <?php
    }
}
