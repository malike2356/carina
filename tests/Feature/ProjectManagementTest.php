<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\Project;
use App\Models\Tenant\ProjectMilestone;
use App\Models\Tenant\ProjectTask;
use App\Models\Tenant\User;
use App\Services\Projects\ProjectService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'project_management')->update(['enabled' => true, 'tenant_overrides' => null]);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('authenticated user can create a project', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Project Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@projects.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $response = $this->post('http://'.$host.'/projects', [
        'title' => 'Loft conversion test project',
        'status' => 'planning',
        'description' => 'Test description',
        'budget_minor' => 500000,
    ]);

    $response->assertRedirect();

    tenancy()->initialize($tenant);
    $project = Project::query()->where('title', 'Loft conversion test project')->firstOrFail();
    expect($project->status)->toBe('planning');
    expect($project->budget_minor)->toBe(500000);
    expect($project->created_by)->toBe($user->id);
    tenancy()->end();
});

it('project appears in the index', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Project Index Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@projects-index.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    Project::query()->create([
        'title' => 'Kitchen refurb project',
        'status' => 'in_progress',
        'created_by' => $user->id,
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/projects')
        ->assertOk()
        ->assertSee('Kitchen refurb project', false);
});

it('user can add a task to a project', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Project Task Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@projects-task.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    $project = Project::query()->create([
        'title' => 'Bathroom renovation',
        'status' => 'planning',
        'created_by' => $user->id,
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');

    $response = $this->post('http://'.$host.'/projects/'.$project->id.'/tasks', [
        'title' => 'Replace shower unit',
        'status' => 'todo',
        'assigned_to' => 'Bob the Plumber',
        'estimated_cost_minor' => 75000,
    ]);

    $response->assertRedirect();

    tenancy()->initialize($tenant);
    $task = ProjectTask::query()->where('project_id', $project->id)->firstOrFail();
    expect($task->title)->toBe('Replace shower unit');
    expect($task->assigned_to)->toBe('Bob the Plumber');
    expect($task->estimated_cost_minor)->toBe(75000);
    tenancy()->end();
});

it('task appears on project show page', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Project Show Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@projects-show.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    $project = Project::query()->create([
        'title' => 'Garden landscaping',
        'status' => 'in_progress',
        'created_by' => $user->id,
    ]);
    ProjectTask::query()->create([
        'project_id' => $project->id,
        'title' => 'Lay new turf',
        'status' => 'todo',
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/projects/'.$project->id)
        ->assertOk()
        ->assertSee('Garden landscaping', false)
        ->assertSee('Lay new turf', false)
        ->assertSee('Task board', false);
});

it('user can add a milestone to a project', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Project Milestone Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@projects-milestone.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    $project = Project::query()->create([
        'title' => 'Extension build',
        'status' => 'in_progress',
        'created_by' => $user->id,
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->post('http://'.$host.'/projects/'.$project->id.'/milestones', [
        'name' => 'Structural sign-off',
        'due_at' => '2026-08-01',
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    expect(ProjectMilestone::query()->where('project_id', $project->id)->value('name'))
        ->toBe('Structural sign-off');
    tenancy()->end();
});

it('task actual costs roll up to project actual_cost_minor', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Project Budget Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@projects-budget.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    $project = Project::query()->create([
        'title' => 'Roof replacement',
        'status' => 'in_progress',
        'created_by' => $user->id,
        'budget_minor' => 1000000,
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->post('http://'.$host.'/projects/'.$project->id.'/tasks', [
        'title' => 'Scaffolding',
        'status' => 'done',
        'actual_cost_minor' => 150000,
    ])->assertRedirect();

    $this->post('http://'.$host.'/projects/'.$project->id.'/tasks', [
        'title' => 'New tiles',
        'status' => 'in_progress',
        'actual_cost_minor' => 250000,
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $project->refresh();
    expect($project->actual_cost_minor)->toBe(400000);

    $stats = app(ProjectService::class)->projectStats($project);
    expect($stats['budget_minor'])->toBe(1000000);
    expect($stats['actual_cost_minor'])->toBe(400000);
    expect($stats['budget_remaining_minor'])->toBe(600000);
    tenancy()->end();
});

it('blocked task status is accepted', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Project Blocked Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@projects-blocked.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    $project = Project::query()->create([
        'title' => 'Blocked task project',
        'status' => 'planning',
        'created_by' => $user->id,
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->post('http://'.$host.'/projects/'.$project->id.'/tasks', [
        'title' => 'Awaiting planning',
        'status' => 'blocked',
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    expect(ProjectTask::query()->where('project_id', $project->id)->value('status'))->toBe('blocked');
    tenancy()->end();
});
