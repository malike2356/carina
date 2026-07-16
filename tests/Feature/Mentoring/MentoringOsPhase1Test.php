<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\Subscription;
use App\Models\Central\SubscriptionPlan;
use App\Models\Central\Tenant;
use App\Models\Tenant\Contact;
use App\Models\Tenant\MentorshipCohort;
use App\Models\Tenant\MentorshipCohortMember;
use App\Models\Tenant\MentorshipProgramme;
use App\Models\Tenant\Pipeline;
use App\Models\Tenant\PipelineStage;
use App\Models\Tenant\User;
use App\Services\Billing\Contracts\SubscriptionServiceInterface;
use App\Services\Pipeline\PipelineService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Database\Seeders\Central\SubscriptionPlanSeeder;
use Illuminate\Support\Facades\Hash;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    $this->seed(SubscriptionPlanSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'community_learning')->update(['enabled' => true]);
    FeatureFlag::query()->where('key', 'mentoring_os')->update(['enabled' => true]);
    FeatureFlag::query()->where('key', 'carina_ai')->update(['enabled' => false]);
});

function mentoringTenantHost(Tenant $tenant): string
{
    return $tenant->domains->first()->domain.'.propreneur.test';
}

it('creates mentorship with programme cohort deal and contact links when rules pass', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mentor Links '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mentor-links.test',
        'plan' => 'starter',
    ]);
    $host = mentoringTenantHost($tenant);
    $tid = (string) $tenant->getTenantKey();

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    $mentor = User::factory()->create(['email' => 'mentor-'.uniqid().'@ml.test', 'password' => Hash::make('secret')]);
    $mentee = User::factory()->create(['email' => 'mentee-'.uniqid().'@ml.test', 'password' => Hash::make('secret')]);

    $prog = MentorshipProgramme::query()->create([
        'tenant_id' => $tid,
        'name' => 'Accelerator',
        'description' => null,
        'is_active' => true,
    ]);
    $cohort = MentorshipCohort::query()->create([
        'mentorship_programme_id' => $prog->id,
        'name' => 'Spring',
        'description' => null,
        'starts_at' => now(),
        'ends_at' => null,
        'is_active' => true,
    ]);
    MentorshipCohortMember::query()->create([
        'mentorship_cohort_id' => $cohort->id,
        'user_id' => $mentee->id,
    ]);

    $contact = Contact::factory()->create([
        'created_by' => $admin->id,
    ]);

    $pipeline = Pipeline::query()->where('is_default', true)->firstOrFail();
    $stage = PipelineStage::query()->where('pipeline_id', $pipeline->id)->ordered()->firstOrFail();
    $deal = app(PipelineService::class)->createDeal([
        'pipeline_id' => $pipeline->id,
        'stage_id' => $stage->id,
        'title' => 'Linked deal',
        'contact_id' => $contact->id,
    ], $admin);

    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($admin, 'web');

    $res = $this->postJson('http://'.$host.'/api/mentorships', [
        'mentor_id' => $mentor->id,
        'mentee_id' => $mentee->id,
        'status' => 'active',
        'mentorship_cohort_id' => $cohort->id,
        'pipeline_deal_id' => $deal->id,
        'contact_id' => $contact->id,
    ]);
    $res->assertCreated();
    expect((int) $res->json('data.mentorship_programme_id'))->toBe((int) $prog->id)
        ->and((int) $res->json('data.mentorship_cohort_id'))->toBe((int) $cohort->id)
        ->and((int) $res->json('data.pipeline_deal_id'))->toBe((int) $deal->id)
        ->and((int) $res->json('data.contact_id'))->toBe((int) $contact->id);
});

it('rejects mentorship cohort when mentee is not a cohort member', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mentor Cohort '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mentor-cohort.test',
        'plan' => 'starter',
    ]);
    $host = mentoringTenantHost($tenant);
    $tid = (string) $tenant->getTenantKey();

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    $mentor = User::factory()->create(['email' => 'm-'.uniqid().'@mc.test']);
    $mentee = User::factory()->create(['email' => 'e-'.uniqid().'@mc.test']);
    $other = User::factory()->create(['email' => 'o-'.uniqid().'@mc.test']);

    $prog = MentorshipProgramme::query()->create([
        'tenant_id' => $tid,
        'name' => 'P',
        'is_active' => true,
    ]);
    $cohort = MentorshipCohort::query()->create([
        'mentorship_programme_id' => $prog->id,
        'name' => 'C',
        'is_active' => true,
    ]);
    MentorshipCohortMember::query()->create([
        'mentorship_cohort_id' => $cohort->id,
        'user_id' => $other->id,
    ]);

    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($admin, 'web');

    $this->postJson('http://'.$host.'/api/mentorships', [
        'mentor_id' => $mentor->id,
        'mentee_id' => $mentee->id,
        'mentorship_cohort_id' => $cohort->id,
    ])->assertStatus(422);
});

it('allows tenant admin on mentoring hub when mentoring_os flag is on and stripe gating is off', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mentor Hub '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mentor-hub.test',
        'plan' => 'starter',
    ]);
    $host = mentoringTenantHost($tenant);

    tenancy()->initialize($tenant);
    completeTenantWorkspaceOnboarding();
    $admin = User::query()->firstOrFail();
    tenancy()->end();

    $this->actingAs($admin, 'web');
    $this->get('http://'.$host.'/mentoring')->assertOk();
});

it('forbids mentoring hub for users without tenant admin mentor or mentee role', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mentor Deny '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mentor-deny.test',
        'plan' => 'starter',
    ]);
    $host = mentoringTenantHost($tenant);

    tenancy()->initialize($tenant);
    completeTenantWorkspaceOnboarding();
    $plain = User::factory()->create([
        'email' => 'plain-'.uniqid().'@mentor-deny.test',
        'password' => Hash::make('secret'),
    ]);
    tenancy()->end();

    $this->actingAs($plain, 'web');
    $this->get('http://'.$host.'/mentoring')->assertForbidden();
});

it('returns 404 for mentoring hub when mentoring_os feature flag is disabled', function (): void {
    FeatureFlag::query()->where('key', 'mentoring_os')->update(['enabled' => false]);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mentor Flag '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mentor-flag.test',
        'plan' => 'starter',
    ]);
    $host = mentoringTenantHost($tenant);

    tenancy()->initialize($tenant);
    completeTenantWorkspaceOnboarding();
    $admin = User::query()->firstOrFail();
    tenancy()->end();

    $this->actingAs($admin, 'web');
    $this->get('http://'.$host.'/mentoring')->assertNotFound();
});

it('denies mentoring hub on paid stripe billing when plan excludes mentoring_os', function (): void {
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => true]);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mentor Bill '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mentor-bill.test',
        'plan' => 'starter',
    ]);
    $host = mentoringTenantHost($tenant);

    $operatorPlan = SubscriptionPlan::query()->where('slug', 'operator')->first();
    expect($operatorPlan)->not->toBeNull();

    Subscription::query()->create([
        'tenant_id' => $tenant->id,
        'plan_id' => $operatorPlan->id,
        'stripe_customer_id' => 'cus_mentor_hub',
        'stripe_subscription_id' => 'sub_mentor_hub_'.uniqid(),
        'plan' => 'operator',
        'status' => 'active',
        'trial_ends_at' => null,
        'current_period_start' => now(),
        'current_period_end' => now()->addMonth(),
        'cancel_at_period_end' => false,
    ]);

    Tenant::query()->whereKey($tenant->id)->update(['trial_ends_at' => now()->subDay()]);
    app(SubscriptionServiceInterface::class)->forgetBillingEntitlementsCache((string) $tenant->id);

    tenancy()->initialize($tenant);
    completeTenantWorkspaceOnboarding();
    $admin = User::query()->firstOrFail();
    tenancy()->end();

    $this->actingAs($admin, 'web');
    $this->get('http://'.$host.'/mentoring')->assertForbidden();
});

it('allows mentoring hub on academy subscription when stripe billing is enabled', function (): void {
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => true]);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mentor Plan '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mentor-plan.test',
        'plan' => 'academy',
    ]);
    $host = mentoringTenantHost($tenant);

    $mentorPlan = SubscriptionPlan::query()->where('slug', 'academy')->first();
    expect($mentorPlan)->not->toBeNull();

    Subscription::query()->create([
        'tenant_id' => $tenant->id,
        'plan_id' => $mentorPlan->id,
        'stripe_customer_id' => 'cus_mentor_plan',
        'stripe_subscription_id' => 'sub_mentor_plan_'.uniqid(),
        'plan' => 'academy',
        'status' => 'active',
        'trial_ends_at' => null,
        'current_period_start' => now(),
        'current_period_end' => now()->addMonth(),
        'cancel_at_period_end' => false,
    ]);

    Tenant::query()->whereKey($tenant->id)->update(['trial_ends_at' => now()->subDay()]);
    app(SubscriptionServiceInterface::class)->forgetBillingEntitlementsCache((string) $tenant->id);

    tenancy()->initialize($tenant);
    completeTenantWorkspaceOnboarding();
    $admin = User::query()->firstOrFail();
    tenancy()->end();

    $this->actingAs($admin, 'web');
    $this->get('http://'.$host.'/mentoring')->assertOk();
});

it('allows mentor role to open mentoring hub without tenant admin', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mentor Role '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mentor-role.test',
        'plan' => 'starter',
    ]);
    $host = mentoringTenantHost($tenant);

    tenancy()->initialize($tenant);
    completeTenantWorkspaceOnboarding();
    $coach = User::factory()->create([
        'email' => 'coach-'.uniqid().'@mentor-role.test',
        'password' => Hash::make('secret'),
    ]);
    $coach->assignRole('mentor');
    tenancy()->end();

    $this->actingAs($coach, 'web');
    $this->get('http://'.$host.'/mentoring')->assertOk();
});

it('allows mentee role to open mentoring hub', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mentee Hub '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mentee-hub.test',
        'plan' => 'starter',
    ]);
    $host = mentoringTenantHost($tenant);

    tenancy()->initialize($tenant);
    completeTenantWorkspaceOnboarding();
    $mentee = User::factory()->create([
        'email' => 'mentee-hub-'.uniqid().'@mentee-hub.test',
        'password' => Hash::make('secret'),
    ]);
    $mentee->assignRole('mentee');
    tenancy()->end();

    $this->actingAs($mentee, 'web');
    $this->get('http://'.$host.'/mentoring')->assertOk();
});
