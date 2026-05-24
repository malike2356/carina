<?php

declare(strict_types=1);

use App\Models\Tenant\Project;
use App\Models\Tenant\ProjectMilestone;
use App\Models\Tenant\ProjectTask;

it('creates milestone attaches task and marks complete', function (): void {
    ['host' => $host, 'tenant' => $tenant, 'user' => $user] = enableProjectManagementForTests();

    tenancy()->initialize($tenant);
    $project = Project::query()->create(['title' => 'Build', 'status' => 'active', 'created_by' => $user->id]);
    tenancy()->end();

    $this->post('http://'.$host.'/projects/'.$project->id.'/milestones', [
        'name' => 'Weathertight',
        'due_at' => '2026-09-01',
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $milestone = ProjectMilestone::query()->where('project_id', $project->id)->firstOrFail();
    tenancy()->end();

    $this->post('http://'.$host.'/projects/'.$project->id.'/tasks', [
        'title' => 'Roof seal',
        'status' => 'todo',
        'milestone_id' => $milestone->id,
    ])->assertRedirect();

    $this->put('http://'.$host.'/projects/'.$project->id.'/milestones/'.$milestone->id, [
        'complete' => 1,
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    expect($milestone->fresh()->completed_at)->not->toBeNull();
    expect(ProjectTask::query()->where('milestone_id', $milestone->id)->exists())->toBeTrue();
    tenancy()->end();
});
