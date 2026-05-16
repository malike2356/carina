<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\Project;
use App\Models\Tenant\ProjectTask;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
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
        ->assertSee('Lay new turf', false);
});
