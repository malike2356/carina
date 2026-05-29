<?php

declare(strict_types=1);

if (! defined('ABSPATH')) {
    exit;
}

final class Propreneur_Calculators_Api
{
    private static ?string $lastError = null;

    /** @var list<string> */
    private const FALLBACK_BASE_URLS = [
        'https://propreneur.uk',
        'https://calc.propreneur.uk',
    ];

    public static function last_error(): ?string
    {
        return self::$lastError;
    }

    /**
     * @return array<string, mixed>|null
     */
    public static function fetch_catalog(bool $force = false): ?array
    {
        self::$lastError = null;
        $settings = Propreneur_Calculators_Settings::get();
        $primary = untrailingslashit($settings['api_base_url']);
        $bases = array_values(array_unique(array_filter([
            $primary,
            ...self::FALLBACK_BASE_URLS,
        ])));

        foreach ($bases as $base) {
            $data = self::fetch_catalog_from_base($base, $force && $base === $primary);
            if ($data !== null) {
                if ($base !== $primary) {
                    self::$lastError = sprintf(
                        /* translators: 1: configured URL, 2: working URL */
                        __('Configured API %1$s failed; using %2$s instead. Update Settings → Propreneur Calculators.', 'propreneur-calculators'),
                        $primary,
                        $base
                    );
                }

                return $data;
            }
        }

        if (self::$lastError === null) {
            self::$lastError = __('Could not reach the Propreneur calculator catalog.', 'propreneur-calculators');
        }

        return null;
    }

    /**
     * @return array<string, mixed>|null
     */
    private static function fetch_catalog_from_base(string $base, bool $force): ?array
    {
        $cacheKey = 'propreneur_calc_catalog_'.md5($base);
        $cacheMinutes = (int) Propreneur_Calculators_Settings::get()['cache_minutes'];

        if (! $force) {
            $cached = get_transient($cacheKey);
            if (is_array($cached) && isset($cached['calculators']) && is_array($cached['calculators'])) {
                return $cached;
            }
        }

        $url = $base.'/calculators/catalog';
        $response = wp_remote_get($url, [
            'timeout' => 15,
            'headers' => [
                'Accept' => 'application/json',
                'User-Agent' => 'PropreneurCalculatorsWP/'.PROPRENEUR_CALCULATORS_VERSION,
            ],
        ]);

        if (is_wp_error($response)) {
            self::$lastError = $url.' — '.$response->get_error_message();

            return null;
        }

        $code = (int) wp_remote_retrieve_response_code($response);
        if ($code < 200 || $code >= 300) {
            self::$lastError = $url.' — HTTP '.$code;

            return null;
        }

        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        if (! is_array($data) || ! isset($data['calculators']) || ! is_array($data['calculators'])) {
            self::$lastError = $url.' — invalid JSON catalog response';

            return null;
        }

        set_transient($cacheKey, $data, $cacheMinutes * MINUTE_IN_SECONDS);

        return $data;
    }

    /**
     * @param  array<string, mixed>  $catalog
     * @return array<string, mixed>|null
     */
    public static function find_calculator(array $catalog, string $slug): ?array
    {
        foreach ($catalog['calculators'] as $row) {
            if (! is_array($row)) {
                continue;
            }
            if (($row['slug'] ?? '') === $slug) {
                return $row;
            }
        }

        return null;
    }
}
