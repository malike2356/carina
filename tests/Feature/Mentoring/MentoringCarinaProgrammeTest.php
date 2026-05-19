<?php

declare(strict_types=1);

use App\Http\Middleware\RequiresMfaVerified;
use App\Models\Carina\CarinaConversation;
use App\Models\Tenant\MentorshipProgrammeCarinaSettings;
use App\Models\Tenant\User;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

require_once __DIR__.'/MentorAssistantTestHelpers.php';

beforeEach(function (): void {
    $this->withoutMiddleware([VerifyCsrfToken::class, RequiresMfaVerified::class]);
    $this->seed(FeatureFlagSeeder::class);
    mentorAssistantBootstrapFlags();
});

afterEach(function (): void {
    if (tenancy()->initialized) {
        tenancy()->end();
    }
});

it('starts a mentor teaching conversation for enrolled mentee', function (): void {
    $s = mentorAssistantScenario();
    tenancy()->initialize($s['tenant']);
    MentorshipProgrammeCarinaSettings::query()->updateOrCreate(
        ['mentorship_programme_id' => $s['programme']->id],
        ['enabled' => true, 'carina_label' => 'Deal Coach']
    );
    tenancy()->end();

    tenancy()->initialize($s['tenant']);
    $mentee = User::query()->findOrFail($s['mentee']->id);
    tenancy()->end();

    $this->actingAs($mentee, 'web');
    $this->get('http://'.$s['host'].'/carina/open-mentor-programme/'.$s['programmeId'])
        ->assertRedirect();
    $conv = CarinaConversation::query()
        ->where('user_id', $s['mentee']->id)
        ->where('programme_id', $s['programme']->id)
        ->latest('id')
        ->first();

    expect($conv)->not->toBeNull()
        ->and($conv->context_type)->toBe('mentor_teaching')
        ->and((int) $conv->context_id)->toBe((int) $s['programme']->id)
        ->and($conv->is_impersonated)->toBeFalse();
    tenancy()->end();
});

it('denies mentor programme carina when assistant disabled', function (): void {
    $s = mentorAssistantScenario();
    tenancy()->initialize($s['tenant']);
    MentorshipProgrammeCarinaSettings::query()->updateOrCreate(
        ['mentorship_programme_id' => $s['programme']->id],
        ['enabled' => false]
    );
    tenancy()->end();

    tenancy()->initialize($s['tenant']);
    $mentee = User::query()->findOrFail($s['mentee']->id);
    tenancy()->end();

    $this->actingAs($mentee, 'web');
    $this->get('http://'.$s['host'].'/carina/open-mentor-programme/'.$s['programmeId'])
        ->assertForbidden();
});

it('denies unenrolled user from mentor programme carina', function (): void {
    $s = mentorAssistantScenario();
    tenancy()->initialize($s['tenant']);
    $stranger = User::factory()->create();
    $stranger->assignRole('mentee');
    tenancy()->end();

    $this->actingAs($stranger, 'web');
    $this->get('http://'.$s['host'].'/carina/open-mentor-programme/'.$s['programmeId'])
        ->assertForbidden();
});
