<?php

declare(strict_types=1);

if (! defined('ABSPATH')) {
    exit;
}

final class Propreneur_Lead_Ingest_Elementor
{
    public static function init(): void
    {
        add_action('elementor_pro/forms/new_record', [self::class, 'handle'], 20, 2);
    }

    /**
     * @param  object  $record  Elementor Pro Form_Record
     * @param  object  $handler  Elementor Pro Ajax_Handler
     */
    public static function handle($record, $handler): void
    {
        if (! is_object($record) || ! method_exists($record, 'get')) {
            return;
        }

        $form_id = self::resolve_form_id($record);
        if ($form_id === '') {
            return;
        }

        if (! Propreneur_Lead_Ingest_Client::should_process('elementor', $form_id)) {
            Propreneur_Lead_Ingest_Client::log('skip elementor form_id='.$form_id);

            return;
        }

        $raw_fields = $record->get('fields');
        if (! is_array($raw_fields)) {
            return;
        }

        $by_label = Propreneur_Lead_Ingest_Field_Mapper::from_elementor_fields($raw_fields);
        $lead = Propreneur_Lead_Ingest_Field_Mapper::from_label_map($by_label);

        $post_id = isset($_POST['post_id']) ? (int) $_POST['post_id'] : 0;

        Propreneur_Lead_Ingest_Client::submit($lead, 'elementor', $form_id, $post_id);
    }

    /**
     * @param  object  $record
     */
    private static function resolve_form_id($record): string
    {
        if (! method_exists($record, 'get_form_settings')) {
            return 'elementor-form';
        }

        $name = (string) $record->get_form_settings('form_name');
        if ($name !== '') {
            return sanitize_title($name);
        }

        $id = (string) $record->get_form_settings('id');
        if ($id !== '') {
            return sanitize_title($id);
        }

        return 'elementor-form';
    }
}
