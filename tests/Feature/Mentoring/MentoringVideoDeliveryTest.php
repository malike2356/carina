<?php

declare(strict_types=1);

use App\Http\Middleware\RequiresMfaVerified;
use App\Models\Tenant\Course;
use App\Models\Tenant\MentorshipPackage;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

require_once __DIR__.'/MentorAssistantTestHelpers.php';

beforeEach(function (): void {
    $this->withoutMiddleware([VerifyCsrfToken::class, RequiresMfaVerified::class]);
    $this->seed(FeatureFlagSeeder::class);
    mentorAssistantBootstrapFlags();
});

it('lets a programme mentor attach a video link to a mentorship module', function (): void {
    $s = mentorAssistantScenario();

    tenancy()->initialize($s['tenant']);
    $course = Course::query()->create([
        'tenant_id' => $s['tid'],
        'name' => 'Deal sourcing video module',
        'description' => 'Watch this training before the quiz.',
        'is_published' => true,
    ]);
    $package = MentorshipPackage::query()->create([
        'tenant_id' => $s['tid'],
        'mentorship_programme_id' => $s['programmeId'],
        'mentor_id' => $s['mentor']->id,
        'name' => 'Video package',
        'slug' => 'video-package-'.uniqid(),
    ]);
    DB::table('mentorship_package_courses')->insert([
        'mentorship_package_id' => $package->id,
        'course_id' => $course->id,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    tenancy()->end();

    mentorAssistantPostAs(
        $s['mentor'],
        $s['host'],
        '/mentoring/programmes/'.$s['programmeId'].'/assistant/materials/modules/'.$course->id.'/video',
        ['video_url' => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
        $s['tenant'],
    )->assertRedirect();

    tenancy()->initialize($s['tenant']);
    $course->refresh();
    expect($course->video_source)->toBe('url')
        ->and($course->video_url)->toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    tenancy()->end();

    mentorAssistantGetAs(
        $s['mentee'],
        $s['host'],
        '/my-programme/'.$s['programmeId'].'/modules/'.$course->id,
        $s['tenant'],
    )
        ->assertOk()
        ->assertSee('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', false);
});

it('lets a programme mentor upload a video file to a mentorship module', function (): void {
    Storage::fake('public');
    $s = mentorAssistantScenario();

    tenancy()->initialize($s['tenant']);
    $course = Course::query()->create([
        'tenant_id' => $s['tid'],
        'name' => 'Uploaded video module',
        'description' => 'Uploaded training.',
        'is_published' => true,
    ]);
    $package = MentorshipPackage::query()->create([
        'tenant_id' => $s['tid'],
        'mentorship_programme_id' => $s['programmeId'],
        'mentor_id' => $s['mentor']->id,
        'name' => 'Upload package',
        'slug' => 'upload-package-'.uniqid(),
    ]);
    DB::table('mentorship_package_courses')->insert([
        'mentorship_package_id' => $package->id,
        'course_id' => $course->id,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    tenancy()->end();

    mentorAssistantPostAs(
        $s['mentor'],
        $s['host'],
        '/mentoring/programmes/'.$s['programmeId'].'/assistant/materials/modules/'.$course->id.'/video',
        ['video_file' => UploadedFile::fake()->create('lesson.mp4', 128, 'video/mp4')],
        $s['tenant'],
    )->assertRedirect();

    tenancy()->initialize($s['tenant']);
    $course->refresh();
    expect($course->video_source)->toBe('upload')
        ->and($course->video_path)->not->toBeNull()
        ->and($course->video_original_name)->toBe('lesson.mp4');
    Storage::disk('public')->assertExists((string) $course->video_path);
    tenancy()->end();
});
