# Academy Content Seeder

## Overview

The Academy content seeder populates all academy tracks and lessons from 274 built-in blog post markdown files. It is idempotent and safe to run multiple times - it uses `updateOrCreate` on slug, so re-running it updates existing records and adds any new ones without creating duplicates.

## How to run

```bash
php artisan academy:seed-content
```

On production, the command will prompt for confirmation before proceeding. To skip the prompt:

```bash
php artisan academy:seed-content --force
```

The academy workspace must already exist before running this command. If it does not:

```bash
php artisan academy:ensure-workspace
php artisan academy:seed-content
```

## What is seeded

11 tracks and 274 lessons in total.

| Track | Slug | Lessons | Source directory |
|---|---|---|---|
| Getting Started | getting-started | 9 | blogPosts/introductory/ (post-01 to post-09) |
| Property Sourcing | property-sourcing | 9 | blogPosts/yearScale/ (02 to 10) |
| Buy-to-Let | buy-to-let | 10 | blogPosts/yearScale/ (11 to 20) |
| Rent-to-Rent | rent-to-rent | 8 | blogPosts/yearScale/ (21 to 28) |
| Serviced Accommodation | serviced-accommodation | 10 | blogPosts/yearScale/ (29 to 38) |
| Commercial Property | commercial-property | 8 | blogPosts/yearScale/ (39 to 46) |
| Strategy and Planning | strategy-planning | 10 | blogPosts/yearScale/ (47 to 56) |
| Regional Markets | regional-markets | 9 | blogPosts/yearScale/ (57 to 65) |
| Legal, Finance and Compliance | legal-finance-compliance | 15 | blogPosts/yearScale/ (66 to 80) |
| Advanced Topics | advanced-topics | 12 | blogPosts/yearScale/ (81 to 92) |
| Investment Metrics Reference | investment-metrics | 174 | blogPosts/Calculations/ (001 to 174) |

**Total: 274 lessons across 11 tracks.**

## How data is extracted from source files

Each blog post markdown file is read and the following fields are extracted:

- **title**: The H1 heading (text after the leading `#`).
- **slug**: The `Slug:` metadata field if present (Calculations files), otherwise derived from the filename by stripping the numeric prefix and sanitising to kebab-case.
- **excerpt**: The first non-empty, non-heading paragraph after any metadata block, truncated to 490 characters.
- **content**: The full markdown body (after the `---` separator for Calculations files; the whole file for others).
- **estimated_minutes**: Word count of content divided by 200, rounded up, minimum 3.

## Re-seeding

The seeder is fully idempotent. Run it again at any time:

```bash
php artisan academy:seed-content
```

Each call will:
- `updateOrCreate` every track by slug (updating title, description, icon, order).
- `updateOrCreate` every lesson by `(track_id, slug)` (updating title, excerpt, content, estimated_minutes, order).
- Update `total_lessons` on each track to the count of its lessons.

## Source files

Original blog post markdown files are at:

```
/opt/lampp/htdocs/VERLOX/xeloxproperties/blogPosts/
    introductory/      -- 9 files (post-01 to post-09)
    yearScale/         -- 91 files (02 to 92, excluding 00-content-plan.md)
    Calculations/      -- 174 files (001 to 174)
```

These files are outside the propreneur-v2 repository. The seeder bakes all content inline into the PHP array so the source files are not required at runtime.

## File locations

| File | Purpose |
|---|---|
| `database/seeders/Tenant/AcademyContentSeeder.php` | The seeder class with all 274 lessons inline |
| `app/Console/Commands/Academy/AcademySeedContentCommand.php` | Artisan command wrapper (`academy:seed-content`) |
| `database/migrations/tenant/2026_05_21_200000_create_academy_tables.php` | Creates `academy_tracks`, `academy_lessons`, `academy_lesson_progress` |
| `app/Models/Tenant/AcademyTrack.php` | Eloquent model for tracks |
| `app/Models/Tenant/AcademyLesson.php` | Eloquent model for lessons |

## Notes

- The seeder runs within the academy tenant context (via `$academyTenant->run()`).
- The `AcademyContentSeeder` can also be called directly from another seeder if needed: `$this->call(AcademyContentSeeder::class)`.
- The Investment Metrics Reference track (174 lessons) is marked as a reference track in practice by its title and icon (`calculator`), but the schema does not have a separate `is_reference` boolean column. If that column is added in a future migration, update the seeder to pass `'is_reference' => true` for that track.
