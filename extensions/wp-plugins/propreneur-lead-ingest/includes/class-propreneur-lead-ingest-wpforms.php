<?php

declare(strict_types=1);

if (! defined('ABSPATH')) {
    exit;
}

final class Propreneur_Lead_Ingest_Wpforms
{
    public static function init(): void
    {
        add_action('wpforms_process_complete', [self::class, 'handle'], 20, 4);
    }

    /**
     * @param  array<int, array<string, mixed>>  $fields
     * @param  array<string, mixed>  $entry
     * @param  array<string, mixed>  $form_data
     */
    public static function handle(array $fields, array $entry, array $form_data, int $entry_id): void
    {
        $form_id = (string) ($form_data['id'] ?? '');
        if ($form_id === '') {
            return;
        }

        if (! Propreneur_Lead_Ingest_Client::should_process('wpforms', $form_id)) {
            Propreneur_Lead_Ingest_Client::log('skip wpforms form_id='.$form_id);

            return;
        }

        $by_label = Propreneur_Lead_Ingest_Field_Mapper::from_wpforms_fields($fields);
        $lead = Propreneur_Lead_Ingest_Field_Mapper::from_label_map($by_label);

        $post_id = 0;
        if (isset($entry['post_id'])) {
            $post_id = (int) $entry['post_id'];
        }

        Propreneur_Lead_Ingest_Client::submit($lead, 'wpforms', $form_id, $post_id);
    }
}
