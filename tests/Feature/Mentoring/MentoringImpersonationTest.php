<?php

declare(strict_types=1);

use App\Http\Middleware\ViewAsMentor;
use App\Models\Carina\CarinaConversation;
use App\Models\Tenant\User;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

require_once __DIR__.'/MentorAssistantTestHelpers.php';

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
    $this->seed(FeatureFlagSeeder::class);
    mentorAssistantBootstrapFlags();
});

it('tags carina conversations created during view as mentor', function (): void {
    $s = mentorAssistantScenario();
    tenancy()->initialize($s['tenant']);

    $admin = User::query()->firstOrFail();

    session([ViewAsMentor::SESSION_KEY => $s['mentor']->id, '_carina_is_impersonated' => true]);

    $conv = CarinaConversation::query()->create([
        'tenant_id' => $s['tid'],
        'user_id' => $admin->id,
        'context_type' => 'mentor_teaching',
        'programme_id' => $s['programme']->id,
        'context_id' => $s['programme']->id,
        'title' => 'Test',
    ]);

    expect($conv->is_impersonated)->toBeTrue();

    session()->forget(ViewAsMentor::SESSION_KEY);
    session()->forget('_carina_is_impersonated');
    tenancy()->end();
});
