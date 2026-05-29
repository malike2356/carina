<?php

declare(strict_types=1);

if (! defined('ABSPATH')) {
    exit;
}

final class Propreneur_Lead_Ingest_Client
{
    public static function tenant_slug(): string
    {
        if (defined('PROPRENEUR_LEAD_INGEST_TENANT_SLUG') && is_string(PROPRENEUR_LEAD_INGEST_TENANT_SLUG)) {
            return sanitize_title(PROPRENEUR_LEAD_INGEST_TENANT_SLUG);
        }

        if (defined('XELOX_PROPRENEUR_TENANT_SLUG') && is_string(XELOX_PROPRENEUR_TENANT_SLUG)) {
            return sanitize_title(XELOX_PROPRENEUR_TENANT_SLUG);
        }

        return sanitize_title((string) Propreneur_Lead_Ingest_Settings::get('tenant_slug'));
    }

    public static function provider_enabled(string $provider): bool
    {
        $key = 'enable_'.$provider;

        return Propreneur_Lead_Ingest_Settings::get($key) !== '0';
    }

    public static function should_process(string $provider, string $form_id): bool
    {
        if (! self::provider_enabled($provider)) {
            return false;
        }

        $mode = (string) Propreneur_Lead_Ingest_Settings::get('form_mode');
        if ($mode !== 'listed') {
            return true;
        }

        $raw = (string) Propreneur_Lead_Ingest_Settings::get('form_ids');
        $allowed = preg_split('/[\s,]+/', trim($raw), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $composite = $provider.':'.$form_id;

        foreach ($allowed as $entry) {
            if ($entry === $form_id || $entry === $composite) {
                return true;
            }
        }

        return false;
    }

    public static function build_source(int $post_id = 0): string
    {
        $host = wp_parse_url(home_url(), PHP_URL_HOST);
        $host = is_string($host) ? $host : '';

        if ($post_id > 0) {
            $path = wp_parse_url((string) get_permalink($post_id), PHP_URL_PATH);
            $path = is_string($path) ? ltrim($path, '/') : '';

            if ($host !== '' && $path !== '') {
                return $host.'/'.$path;
            }
        }

        $referer = wp_get_referer();
        if (is_string($referer) && $referer !== '') {
            $ref_host = wp_parse_url($referer, PHP_URL_HOST);
            $ref_path = wp_parse_url($referer, PHP_URL_PATH);
            if (is_string($ref_host) && is_string($ref_path)) {
                return $ref_host.ltrim($ref_path, '/');
            }
        }

        return $host !== '' ? $host : 'wordpress';
    }

    public static function segment_from_subject(string $subject): string
    {
        $lower = strtolower($subject);

        if (str_contains($lower, 'landlord')) {
            return 'landlord';
        }

        if (str_contains($lower, 'deal sourcer') || str_contains($lower, 'sourcer')) {
            return 'deal_sourcer';
        }

        if (str_contains($lower, 'agent') || str_contains($lower, 'letting agent')) {
            return 'agent';
        }

        if (str_contains($lower, 'investor')) {
            return 'investor';
        }

        if (str_contains($lower, 'tenant') || str_contains($lower, 'rent')) {
            return 'tenant';
        }

        return 'investor';
    }

    /**
     * @param  array{first_name: string, last_name: string, email: string, phone: string, subject: string, message: string}  $lead
     */
    public static function submit(array $lead, string $provider, string $form_id, int $post_id = 0): void
    {
        $email = trim($lead['email']);
        if ($email === '' || ! is_email($email)) {
            self::log('skip missing email provider='.$provider.' form_id='.$form_id);

            return;
        }

        $tenant_slug = self::tenant_slug();
        if ($tenant_slug === '') {
            self::log('skip missing tenant slug');

            return;
        }

        $ingest_url = (string) Propreneur_Lead_Ingest_Settings::get('ingest_url');
        if ($ingest_url === '') {
            self::log('skip missing ingest URL');

            return;
        }

        $subject = trim($lead['subject']);

        $body = [
            'tenant_slug' => $tenant_slug,
            'first_name' => trim($lead['first_name']),
            'last_name' => trim($lead['last_name']),
            'email' => $email,
            'phone' => trim($lead['phone']),
            'subject' => $subject,
            'message' => trim($lead['message']),
            'source' => self::build_source($post_id),
            'segment' => self::segment_from_subject($subject),
        ];

        $response = wp_remote_post($ingest_url, [
            'headers' => [
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
            ],
            'body' => wp_json_encode($body),
            'timeout' => 15,
            'blocking' => true,
        ]);

        if (is_wp_error($response)) {
            self::log('ingest failed: '.$response->get_error_message());

            return;
        }

        $code = (int) wp_remote_retrieve_response_code($response);
        if ($code < 200 || $code >= 300) {
            self::log('ingest HTTP '.$code.' body='.wp_remote_retrieve_body($response));

            return;
        }

        self::log('ingest ok provider='.$provider.' tenant='.$tenant_slug.' email='.$email.' form_id='.$form_id);
    }

    public static function log(string $message): void
    {
        $settings_debug = Propreneur_Lead_Ingest_Settings::get('log_debug') === '1';
        $wp_debug = defined('WP_DEBUG') && WP_DEBUG;

        if (! $settings_debug && ! $wp_debug) {
            return;
        }

        error_log('[propreneur-lead-ingest] '.$message);
    }
}
