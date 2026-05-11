<?php

declare(strict_types=1);

use App\Models\Central\Domain;
use App\Models\Central\FeatureFlag;
use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\CommunityPost;
use App\Models\Tenant\Course;
use App\Models\Tenant\MentorshipRelationship;
use App\Models\Tenant\Pipeline;
use App\Models\Tenant\PipelineDeal;
use App\Models\Tenant\PipelineStage;
use App\Models\Tenant\ReportDefinition;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Facades\Hash;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->whereIn('key', ['carina_ai', 'community_learning', 'reporting_intelligence', 'pipeline'])->update(['enabled' => true]);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('resolves Carina context models for reporting, learning, mentorship, and pipeline deals', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Carina ext '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@carina-ext.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $tid = (string) tenant('id');

    $report = ReportDefinition::query()->create([
        'name' => 'Monthly KPIs',
        'type' => 'portfolio',
        'filters' => ['status' => 'owned'],
        'columns' => ['address_line1'],
        'created_by' => $user->id,
    ]);

    $course = Course::query()->create([
        'tenant_id' => $tid,
        'name' => 'Intro underwriting',
        'description' => 'Basics for UK BTL',
        'is_published' => true,
    ]);

    $post = CommunityPost::query()->create([
        'tenant_id' => $tid,
        'user_id' => $user->id,
        'type' => 'post',
        'title' => 'Market note',
        'content' => 'Discussion about yields in the Midlands.',
        'tags' => ['deals'],
    ]);

    $mentor = User::factory()->create([
        'email' => 'mentor-'.uniqid().'@carina-ext.test',
        'password' => Hash::make('password'),
    ]);
    $mentee = User::factory()->create([
        'email' => 'mentee-'.uniqid().'@carina-ext.test',
        'password' => Hash::make('password'),
    ]);
    $mentorship = MentorshipRelationship::query()->create([
        'tenant_id' => $tid,
        'mentor_id' => $mentor->id,
        'mentee_id' => $mentee->id,
        'status' => 'active',
    ]);

    $pipeline = Pipeline::query()->where('is_default', true)->firstOrFail();
    $stage = PipelineStage::query()->where('pipeline_id', $pipeline->id)->ordered()->firstOrFail();
    $pipelineDeal = PipelineDeal::query()->create([
        'pipeline_id' => $pipeline->id,
        'stage_id' => $stage->id,
        'title' => 'Bridge refurb card',
        'position' => 0,
        'created_by' => $user->id,
        'priority' => 'medium',
    ]);

    $cases = [
        ['report', $report->id, $report],
        ['course', $course->id, $course],
        ['community_post', $post->id, $post],
        ['mentorship', $mentorship->id, $mentorship],
        ['pipeline_deal', $pipelineDeal->id, $pipelineDeal],
    ];

    foreach ($cases as [$type, $id, $model]) {
        $conv = CarinaConversation::query()->create([
            'tenant_id' => $tid,
            'user_id' => $user->id,
            'context_type' => $type,
            'context_id' => $id,
            'title' => 'Test '.$type,
        ]);
        expect($conv->resolveContextModel()?->is($model))->toBeTrue();
    }

    tenancy()->end();
});

it('opens Carina from a pipeline deal card route', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Carina PD '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@carina-pd.test',
        'plan' => 'starter',
    ]);
    $subdomain = $tenant->domains->first()?->domain ?? $tenant->slug;
    $host = $subdomain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $pipeline = Pipeline::query()->where('is_default', true)->firstOrFail();
    $stage = PipelineStage::query()->where('pipeline_id', $pipeline->id)->ordered()->firstOrFail();
    $pipelineDeal = PipelineDeal::query()->create([
        'pipeline_id' => $pipeline->id,
        'stage_id' => $stage->id,
        'title' => 'Card for Carina',
        'position' => 0,
        'created_by' => $user->id,
        'priority' => 'medium',
    ]);

    expect(Domain::query()->where('tenant_id', $tenant->id)->where('domain', $subdomain)->exists())->toBeTrue();

    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->post('http://'.$host.'/carina/conversations', [
        'context_type' => 'pipeline_deal',
        'context_id' => $pipelineDeal->getKey(),
    ])->assertRedirect();

    tenancy()->end();
    tenancy()->initialize($tenant);
    $conv = CarinaConversation::query()->latest('id')->first();
    expect($conv)->not->toBeNull()
        ->and($conv->context_type)->toBe('pipeline_deal')
        ->and((int) $conv->context_id)->toBe($pipelineDeal->id);
    tenancy()->end();
});
