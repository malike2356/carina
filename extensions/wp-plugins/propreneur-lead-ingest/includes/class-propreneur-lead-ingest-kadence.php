<?php

declare(strict_types=1);

if (! defined('ABSPATH')) {
    exit;
}

final class Propreneur_Lead_Ingest_Kadence
{
    public static function init(): void
    {
        add_action('kadence_blocks_form_submission', [self::class, 'handle'], 20, 4);
    }

    /**
     * @param  array<string, mixed>  $form_args
     * @param  array<int|string, array<string, mixed>>  $fields
     */
    public static function handle(
        array $form_args,
        array $fields,
        string $form_id,
        int $post_id,
    ): void {
        if (! Propreneur_Lead_Ingest_Client::should_process('kadence', $form_id)) {
            Propreneur_Lead_Ingest_Client::log('skip kadence form_id='.$form_id);

            return;
        }

        $by_label = Propreneur_Lead_Ingest_Field_Mapper::from_kadence_fields($fields);
        $lead = Propreneur_Lead_Ingest_Field_Mapper::from_label_map($by_label);
        Propreneur_Lead_Ingest_Client::submit($lead, 'kadence', $form_id, $post_id);
    }
}
