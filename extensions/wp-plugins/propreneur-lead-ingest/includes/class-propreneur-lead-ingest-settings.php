<?php

declare(strict_types=1);

if (! defined('ABSPATH')) {
    exit;
}

final class Propreneur_Lead_Ingest_Settings
{
    private const OPTION_KEY = 'propreneur_lead_ingest_settings';

    private const DEFAULTS = [
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
    ];

    public static function init(): void
    {
        add_action('admin_menu', [self::class, 'register_menu']);
        add_action('admin_init', [self::class, 'register_settings']);
    }

    public static function register_menu(): void
    {
        add_options_page(
            __('Propreneur Lead Ingest', 'propreneur-lead-ingest'),
            __('Propreneur Lead Ingest', 'propreneur-lead-ingest'),
            'manage_options',
            'propreneur-lead-ingest',
            [self::class, 'render_page'],
        );
    }

    public static function register_settings(): void
    {
        register_setting(
            'propreneur_lead_ingest',
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

        $clean['tenant_slug'] = sanitize_title((string) ($input['tenant_slug'] ?? ''));
        $clean['ingest_url'] = esc_url_raw((string) ($input['ingest_url'] ?? self::DEFAULTS['ingest_url']));
        $clean['form_mode'] = ($input['form_mode'] ?? '') === 'listed' ? 'listed' : 'all';
        $clean['form_ids'] = self::sanitize_form_ids((string) ($input['form_ids'] ?? ''));
        $clean['log_debug'] = ! empty($input['log_debug']) ? '1' : '0';
        $clean['enable_kadence'] = ! empty($input['enable_kadence']) ? '1' : '0';
        $clean['enable_cf7'] = ! empty($input['enable_cf7']) ? '1' : '0';
        $clean['enable_wpforms'] = ! empty($input['enable_wpforms']) ? '1' : '0';
        $clean['enable_fluentforms'] = ! empty($input['enable_fluentforms']) ? '1' : '0';
        $clean['enable_elementor'] = ! empty($input['enable_elementor']) ? '1' : '0';

        if ($clean['ingest_url'] === '') {
            $clean['ingest_url'] = self::DEFAULTS['ingest_url'];
        }

        return $clean;
    }

    private static function sanitize_form_ids(string $raw): string
    {
        $parts = preg_split('/[\s,]+/', trim($raw), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $ids = [];

        foreach ($parts as $part) {
            $id = sanitize_text_field($part);
            if ($id !== '') {
                $ids[] = $id;
            }
        }

        return implode("\n", array_unique($ids));
    }

    public static function render_page(): void
    {
        if (! current_user_can('manage_options')) {
            return;
        }

        $settings = self::get();
        ?>
        <div class="wrap">
            <h1><?php echo esc_html__('Propreneur Lead Ingest', 'propreneur-lead-ingest'); ?></h1>
            <p><?php echo esc_html__('Connect WordPress forms on this site to your Propreneur CRM contacts.', 'propreneur-lead-ingest'); ?></p>
            <form method="post" action="options.php">
                <?php settings_fields('propreneur_lead_ingest'); ?>
                <table class="form-table" role="presentation">
                    <tr>
                        <th scope="row"><label for="pli_tenant_slug"><?php esc_html_e('Tenant slug', 'propreneur-lead-ingest'); ?></label></th>
                        <td>
                            <input name="<?php echo esc_attr(self::OPTION_KEY); ?>[tenant_slug]" id="pli_tenant_slug" type="text" class="regular-text" value="<?php echo esc_attr($settings['tenant_slug']); ?>" required />
                            <p class="description"><?php esc_html_e('Your workspace subdomain, e.g. xelox for xelox.propreneur.uk', 'propreneur-lead-ingest'); ?></p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="pli_ingest_url"><?php esc_html_e('Ingest URL', 'propreneur-lead-ingest'); ?></label></th>
                        <td>
                            <input name="<?php echo esc_attr(self::OPTION_KEY); ?>[ingest_url]" id="pli_ingest_url" type="url" class="large-text" value="<?php echo esc_attr($settings['ingest_url']); ?>" />
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><?php esc_html_e('Form providers', 'propreneur-lead-ingest'); ?></th>
                        <td>
                            <label><input type="checkbox" name="<?php echo esc_attr(self::OPTION_KEY); ?>[enable_kadence]" value="1" <?php checked($settings['enable_kadence'], '1'); ?> /> <?php esc_html_e('Kadence Blocks Form', 'propreneur-lead-ingest'); ?></label><br>
                            <label><input type="checkbox" name="<?php echo esc_attr(self::OPTION_KEY); ?>[enable_cf7]" value="1" <?php checked($settings['enable_cf7'], '1'); ?> /> <?php esc_html_e('Contact Form 7', 'propreneur-lead-ingest'); ?></label><br>
                            <label><input type="checkbox" name="<?php echo esc_attr(self::OPTION_KEY); ?>[enable_wpforms]" value="1" <?php checked($settings['enable_wpforms'], '1'); ?> /> <?php esc_html_e('WPForms', 'propreneur-lead-ingest'); ?></label><br>
                            <label><input type="checkbox" name="<?php echo esc_attr(self::OPTION_KEY); ?>[enable_fluentforms]" value="1" <?php checked($settings['enable_fluentforms'], '1'); ?> /> <?php esc_html_e('Fluent Forms', 'propreneur-lead-ingest'); ?></label><br>
                            <label><input type="checkbox" name="<?php echo esc_attr(self::OPTION_KEY); ?>[enable_elementor]" value="1" <?php checked($settings['enable_elementor'], '1'); ?> /> <?php esc_html_e('Elementor Pro Form widget', 'propreneur-lead-ingest'); ?></label>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><?php esc_html_e('Which forms', 'propreneur-lead-ingest'); ?></th>
                        <td>
                            <fieldset>
                                <label>
                                    <input type="radio" name="<?php echo esc_attr(self::OPTION_KEY); ?>[form_mode]" value="all" <?php checked($settings['form_mode'], 'all'); ?> />
                                    <?php esc_html_e('All forms from enabled providers', 'propreneur-lead-ingest'); ?>
                                </label><br>
                                <label>
                                    <input type="radio" name="<?php echo esc_attr(self::OPTION_KEY); ?>[form_mode]" value="listed" <?php checked($settings['form_mode'], 'listed'); ?> />
                                    <?php esc_html_e('Only listed form IDs (one per line)', 'propreneur-lead-ingest'); ?>
                                </label>
                            </fieldset>
                            <textarea name="<?php echo esc_attr(self::OPTION_KEY); ?>[form_ids]" class="large-text code" rows="5" placeholder="kadence:44_090e99-77&#10;cf7:123&#10;elementor:contact"><?php echo esc_textarea($settings['form_ids']); ?></textarea>
                            <p class="description"><?php esc_html_e('Optional prefix: kadence:, cf7:, wpforms:, fluentforms:, elementor: — or use the raw form ID only. Elementor uses the form name from the widget settings.', 'propreneur-lead-ingest'); ?></p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><?php esc_html_e('Debug log', 'propreneur-lead-ingest'); ?></th>
                        <td>
                            <label>
                                <input type="checkbox" name="<?php echo esc_attr(self::OPTION_KEY); ?>[log_debug]" value="1" <?php checked($settings['log_debug'], '1'); ?> />
                                <?php esc_html_e('Log ingest results to PHP error log (prefix [propreneur-lead-ingest])', 'propreneur-lead-ingest'); ?>
                            </label>
                        </td>
                    </tr>
                </table>
                <?php submit_button(); ?>
            </form>
            <hr>
            <h2><?php esc_html_e('Optional wp-config.php override', 'propreneur-lead-ingest'); ?></h2>
            <pre><code>define('PROPRENEUR_LEAD_INGEST_TENANT_SLUG', 'your-slug');</code></pre>
        </div>
        <?php
    }

    /**
     * @return array<string, string>
     */
    public static function get(?string $key = null): array|string
    {
        $stored = get_option(self::OPTION_KEY, []);
        $settings = array_merge(self::DEFAULTS, is_array($stored) ? $stored : []);

        if ($key === null) {
            return $settings;
        }

        return $settings[$key] ?? self::DEFAULTS[$key] ?? '';
    }

    /**
     * @param  array<string, string>  $values
     */
    public static function update(array $values): void
    {
        $current = self::get();
        update_option(self::OPTION_KEY, array_merge($current, self::sanitize($values)));
    }
}
