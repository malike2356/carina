<?php

declare(strict_types=1);

if (! defined('ABSPATH')) {
    exit;
}

/**
 * Map heterogeneous form fields to a normalized lead payload.
 */
final class Propreneur_Lead_Ingest_Field_Mapper
{
    /**
     * @param  array<string, string>  $by_label  lowercase label/key => value
     * @return array{first_name: string, last_name: string, email: string, phone: string, subject: string, message: string}
     */
    public static function from_label_map(array $by_label): array
    {
        $email = self::first_value($by_label, ['email address', 'email', 'your-email', 'e-mail']);
        $first = self::first_value($by_label, ['first name', 'first-name', 'firstname', 'fname', 'name']);
        $last = self::first_value($by_label, ['last name', 'last-name', 'lastname', 'lname', 'surname']);
        $full = self::first_value($by_label, ['your name', 'full name', 'fullname']);

        if ($first === '' && $full !== '') {
            $parts = preg_split('/\s+/', trim($full), 2) ?: [];
            $first = $parts[0] ?? '';
            $last = $parts[1] ?? $last;
        }

        if ($first === '' && $last !== '') {
            $first = $last;
            $last = '';
        }

        if ($first === '') {
            $first = 'Website';
        }

        return [
            'first_name' => $first,
            'last_name' => $last,
            'email' => $email,
            'phone' => self::first_value($by_label, ['phone', 'telephone', 'tel', 'mobile', 'your-phone', 'phone number']),
            'subject' => self::first_value($by_label, ['subject', 'your-subject', 'topic', 'enquiry type']),
            'message' => self::first_value($by_label, ['message', 'your-message', 'comments', 'comment', 'enquiry', 'details']),
        ];
    }

    /**
     * @param  array<string, mixed>  $raw  field name/key => value
     * @return array<string, string>
     */
    public static function normalize_keys(array $raw): array
    {
        $by_label = [];

        foreach ($raw as $key => $value) {
            if (is_array($value)) {
                $value = implode(', ', array_map('strval', $value));
            }

            $label = self::normalize_key((string) $key);
            if ($label === '' || str_starts_with($label, '_')) {
                continue;
            }

            $by_label[$label] = trim((string) $value);
        }

        return $by_label;
    }

    /**
     * @param  array<int|string, array<string, mixed>>  $kadence_fields
     * @return array<string, string>
     */
    public static function from_kadence_fields(array $kadence_fields): array
    {
        $by_label = [];

        foreach ($kadence_fields as $field) {
            if (! is_array($field)) {
                continue;
            }

            $label = self::normalize_key((string) ($field['label'] ?? ''));
            if ($label === '') {
                continue;
            }

            $value = $field['value'] ?? '';
            if (is_array($value)) {
                $value = implode(', ', array_map('strval', $value));
            }

            $by_label[$label] = trim((string) $value);
        }

        return $by_label;
    }

    /**
     * @param  array<string, array<string, mixed>>  $elementor_fields
     * @return array<string, string>
     */
    public static function from_elementor_fields(array $elementor_fields): array
    {
        $raw = [];

        foreach ($elementor_fields as $id => $field) {
            if (! is_array($field)) {
                continue;
            }

            $value = $field['value'] ?? '';
            if (is_array($value)) {
                $value = implode(', ', array_map('strval', $value));
            }

            $value = trim((string) $value);
            if ($value === '') {
                continue;
            }

            $title = self::normalize_key((string) ($field['title'] ?? ''));
            if ($title !== '') {
                $raw[$title] = $value;
            }

            $raw[self::normalize_key((string) $id)] = $value;

            $type = self::normalize_key((string) ($field['type'] ?? ''));
            if ($type === 'email' && ! isset($raw['email'])) {
                $raw['email'] = $value;
            }
        }

        return self::normalize_keys($raw);
    }

    /**
     * @param  array<int, array<string, mixed>>  $wpforms_fields
     * @return array<string, string>
     */
    public static function from_wpforms_fields(array $wpforms_fields): array
    {
        $raw = [];

        foreach ($wpforms_fields as $field) {
            if (! is_array($field)) {
                continue;
            }

            $name = (string) ($field['name'] ?? '');
            if ($name === '') {
                continue;
            }

            $value = $field['value'] ?? '';
            if (is_array($value)) {
                $value = implode(', ', array_map('strval', $value));
            }

            $raw[$name] = trim((string) $value);
        }

        return self::normalize_keys($raw);
    }

    private static function normalize_key(string $key): string
    {
        $key = strtolower(trim($key));
        $key = str_replace(['_', '-'], ' ', $key);

        return preg_replace('/\s+/', ' ', $key) ?? $key;
    }

    /**
     * @param  array<string, string>  $map
     * @param  list<string>  $keys
     */
    private static function first_value(array $map, array $keys): string
    {
        foreach ($keys as $key) {
            if (isset($map[$key]) && $map[$key] !== '') {
                return $map[$key];
            }
        }

        return '';
    }
}
