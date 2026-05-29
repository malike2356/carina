<?php

declare(strict_types=1);

if (! defined('ABSPATH')) {
    exit;
}

final class Propreneur_Calculators_Api
{
    /**
     * @return array<string, mixed>|null
     */
    public static function fetch_catalog(bool $force = false): ?array
    {
        $settings = Propreneur_Calculators_Settings::get();
        $base = untrailingslashit($settings['api_base_url']);
        $cacheKey = 'propreneur_calc_catalog_'.md5($base);
        $cacheMinutes = (int) $settings['cache_minutes'];

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
            return null;
        }

        $code = (int) wp_remote_retrieve_response_code($response);
        if ($code < 200 || $code >= 300) {
            return null;
        }

        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        if (! is_array($data) || ! isset($data['calculators']) || ! is_array($data['calculators'])) {
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
