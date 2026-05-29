<?php

declare(strict_types=1);

if (! defined('ABSPATH')) {
    exit;
}

final class Propreneur_Lead_Ingest_Fluentforms
{
    public static function init(): void
    {
        add_action('fluentform/submission_inserted', [self::class, 'handle'], 20, 3);
    }

    /**
     * @param  array<string, mixed>  $form_data
     */
    public static function handle(int $insert_id, array $form_data, object $form): void
    {
        $form_id = (string) ($form->id ?? '');
        if ($form_id === '') {
            return;
        }

        if (! Propreneur_Lead_Ingest_Client::should_process('fluentforms', $form_id)) {
            Propreneur_Lead_Ingest_Client::log('skip fluentforms form_id='.$form_id);

            return;
        }

        $by_label = Propreneur_Lead_Ingest_Field_Mapper::normalize_keys($form_data);
        $lead = Propreneur_Lead_Ingest_Field_Mapper::from_label_map($by_label);

        Propreneur_Lead_Ingest_Client::submit($lead, 'fluentforms', $form_id, 0);
    }
}
