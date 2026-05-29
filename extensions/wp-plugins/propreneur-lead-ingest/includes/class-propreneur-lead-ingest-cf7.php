<?php

declare(strict_types=1);

if (! defined('ABSPATH')) {
    exit;
}

final class Propreneur_Lead_Ingest_Cf7
{
    public static function init(): void
    {
        add_action('wpcf7_mail_sent', [self::class, 'handle'], 20, 1);
    }

    /**
     * @param  WPCF7_ContactForm  $contact_form
     */
    public static function handle($contact_form): void
    {
        if (! class_exists('WPCF7_Submission')) {
            return;
        }

        $submission = WPCF7_Submission::get_instance();
        if ($submission === null) {
            return;
        }

        $form_id = (string) $contact_form->id();
        if (! Propreneur_Lead_Ingest_Client::should_process('cf7', $form_id)) {
            Propreneur_Lead_Ingest_Client::log('skip cf7 form_id='.$form_id);

            return;
        }

        $posted = $submission->get_posted_data();
        if (! is_array($posted)) {
            return;
        }

        $by_label = Propreneur_Lead_Ingest_Field_Mapper::normalize_keys($posted);
        $lead = Propreneur_Lead_Ingest_Field_Mapper::from_label_map($by_label);

        $post_id = 0;
        $referer = $submission->get_meta('url');
        if (is_string($referer) && $referer !== '') {
            $post_id = url_to_postid($referer);
        }

        Propreneur_Lead_Ingest_Client::submit($lead, 'cf7', $form_id, $post_id);
    }
}
