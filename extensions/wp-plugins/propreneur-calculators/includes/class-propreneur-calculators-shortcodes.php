<?php

declare(strict_types=1);

if (! defined('ABSPATH')) {
    exit;
}

final class Propreneur_Calculators_Shortcodes
{
    public static function register(): void
    {
        add_shortcode('propreneur_calculators', [self::class, 'render_hub']);
        add_shortcode('propreneur_calculator', [self::class, 'render_single']);
    }

    /**
     * @param  array<string, string>|string  $atts
     */
    public static function render_hub($atts): string
    {
        $settings = Propreneur_Calculators_Settings::get();
        $atts = shortcode_atts([
            'default' => $settings['default_slug'],
            'height' => $settings['iframe_height'],
        ], $atts, 'propreneur_calculators');

        $catalog = Propreneur_Calculators_Api::fetch_catalog();
        if ($catalog === null) {
            $detail = Propreneur_Calculators_Api::last_error();

            return self::error_box(
                __('Could not load calculators from Propreneur.', 'propreneur-calculators')
                .($detail ? ' '.$detail : ' '
                    .__('Set API base URL to https://propreneur.uk under Settings → Propreneur Calculators.', 'propreneur-calculators'))
            );
        }

        $fallbackNotice = Propreneur_Calculators_Api::last_error();

        $defaultSlug = sanitize_key($atts['default']);
        $height = max(400, min(2400, (int) $atts['height']));
        $instanceId = 'pc-hub-'.wp_generate_password(8, false, false);

        $groups = [
            'strategies' => __('Deal strategies', 'propreneur-calculators'),
            'tools' => __('Underwriting tools', 'propreneur-calculators'),
            'utilities' => __('Utility calculators', 'propreneur-calculators'),
        ];

        ob_start();
        ?>
        <?php if ($fallbackNotice) : ?>
            <p class="propreneur-calculators-notice" style="margin:0 0 1rem;padding:0.75rem 1rem;border:1px solid #fcd34d;background:#fffbeb;color:#92400e;border-radius:8px;font-size:0.875rem;">
                <?php echo esc_html($fallbackNotice); ?>
            </p>
        <?php endif; ?>
        <div class="propreneur-calculators-hub" id="<?php echo esc_attr($instanceId); ?>" data-default="<?php echo esc_attr($defaultSlug); ?>" data-height="<?php echo esc_attr((string) $height); ?>">
            <div class="propreneur-calculators-hub__layout">
                <aside class="propreneur-calculators-hub__nav" aria-label="<?php esc_attr_e('Calculator list', 'propreneur-calculators'); ?>">
                    <?php foreach ($groups as $groupKey => $groupLabel) : ?>
                        <?php
                        $items = $catalog['groups'][$groupKey] ?? [];
                        if (! is_array($items) || $items === []) {
                            continue;
                        }
                        ?>
                        <div class="propreneur-calculators-hub__group">
                            <p class="propreneur-calculators-hub__group-title"><?php echo esc_html($groupLabel); ?></p>
                            <ul class="propreneur-calculators-hub__list">
                                <?php foreach ($items as $calc) : ?>
                                    <?php if (! is_array($calc)) {
                                        continue;
                                    } ?>
                                    <li>
                                        <button type="button"
                                                class="propreneur-calculators-hub__pick"
                                                data-slug="<?php echo esc_attr((string) ($calc['slug'] ?? '')); ?>"
                                                data-embed-url="<?php echo esc_url((string) ($calc['embed_url'] ?? '')); ?>"
                                                data-label="<?php echo esc_attr((string) ($calc['label'] ?? '')); ?>">
                                            <?php echo esc_html((string) ($calc['label'] ?? '')); ?>
                                        </button>
                                    </li>
                                <?php endforeach; ?>
                            </ul>
                        </div>
                    <?php endforeach; ?>
                </aside>
                <div class="propreneur-calculators-hub__main">
                    <p class="propreneur-calculators-hub__active-label" data-active-label></p>
                    <iframe class="propreneur-calculators-hub__iframe"
                            title="<?php esc_attr_e('Propreneur calculator', 'propreneur-calculators'); ?>"
                            loading="lazy"
                            referrerpolicy="no-referrer-when-downgrade"
                            style="width:100%;min-height:<?php echo esc_attr((string) $height); ?>px;border:0;"></iframe>
                    <p class="propreneur-calculators-hub__credit">
                        <?php
                        printf(
                            /* translators: %s: propcalc link */
                            esc_html__('Powered by %s — show-your-working UK property calculators.', 'propreneur-calculators'),
                            '<a href="'.esc_url($settings['api_base_url']).'" target="_blank" rel="noopener">Propcalc</a>'
                        );
                        ?>
                    </p>
                </div>
            </div>
        </div>
        <?php

        return (string) ob_get_clean();
    }

    /**
     * @param  array<string, string>|string  $atts
     */
    public static function render_single($atts): string
    {
        $settings = Propreneur_Calculators_Settings::get();
        $atts = shortcode_atts([
            'slug' => $settings['default_slug'],
            'height' => $settings['iframe_height'],
            'title' => '',
        ], $atts, 'propreneur_calculator');

        $slug = sanitize_key($atts['slug']);
        if ($slug === '') {
            return self::error_box(__('Missing calculator slug.', 'propreneur-calculators'));
        }

        $catalog = Propreneur_Calculators_Api::fetch_catalog();
        $calc = $catalog !== null ? Propreneur_Calculators_Api::find_calculator($catalog, $slug) : null;

        $base = untrailingslashit($settings['api_base_url']);
        $embedUrl = is_array($calc) ? (string) ($calc['embed_url'] ?? '') : $base.'/calculators/'.$slug.'/embed';
        $label = is_array($calc) ? (string) ($calc['label'] ?? $slug) : $slug;
        $title = $atts['title'] !== '' ? $atts['title'] : $label;
        $height = max(400, min(2400, (int) $atts['height']));
        $iframeId = 'pc-embed-'.wp_generate_password(8, false, false);

        ob_start();
        ?>
        <div class="propreneur-calculator-embed">
            <iframe id="<?php echo esc_attr($iframeId); ?>"
                    class="propreneur-calculator-embed__iframe"
                    src="<?php echo esc_url($embedUrl); ?>"
                    title="<?php echo esc_attr($title); ?>"
                    loading="lazy"
                    referrerpolicy="no-referrer-when-downgrade"
                    style="width:100%;min-height:<?php echo esc_attr((string) $height); ?>px;border:0;"></iframe>
        </div>
        <?php

        return (string) ob_get_clean();
    }

    private static function error_box(string $message): string
    {
        return '<div class="propreneur-calculators-error" style="padding:1rem;border:1px solid #fca5a5;background:#fef2f2;color:#991b1b;border-radius:8px;">'
            .esc_html($message)
            .'</div>';
    }
}
