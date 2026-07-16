<?php

declare(strict_types=1);

use App\Models\Tenant\Project;
use App\Models\Tenant\ProjectTask;

it('adds completes reorders and creates subtasks', function (): void {
    ['host' => $host, 'tenant' => $tenant, 'user' => $user] = enableProjectManagementForTests();

    tenancy()->initialize($tenant);
    $project = Project::query()->create([
        'title' => 'Kitchen refurb',
        'status' => 'active',
        'created_by' => $user->id,
        'owner_user_id' => $user->id,
    ]);
    tenancy()->end();

    $this->post('http://'.$host.'/projects/'.$project->id.'/tasks', [
        'title' => 'Order units',
        'status' => 'todo',
        'assigned_to_user_id' => $user->id,
    ], ['Accept' => 'application/json'])->assertOk();

    tenancy()->initialize($tenant);
    $parent = ProjectTask::query()->where('project_id', $project->id)->firstOrFail();
    tenancy()->end();

    $this->post('http://'.$host.'/projects/'.$project->id.'/tasks', [
        'title' => 'Fit handles',
        'status' => 'todo',
        'parent_task_id' => $parent->id,
    ])->assertRedirect();

    $this->put('http://'.$host.'/projects/'.$project->id.'/tasks/'.$parent->id, [
        'title' => 'Order units',
        'status' => 'done',
        'assigned_to_user_id' => $user->id,
    ], ['Accept' => 'application/json'])->assertOk();

    $this->post('http://'.$host.'/projects/'.$project->id.'/tasks/reorder', [
        'task_ids' => [$parent->id],
    ], ['Accept' => 'application/json'])->assertOk();

    tenancy()->initialize($tenant);
    expect(ProjectTask::query()->where('parent_task_id', $parent->id)->count())->toBe(1);
    expect($parent->fresh()->status)->toBe('done');
    tenancy()->end();
});

it('moves task across kanban columns via json', function (): void {
    ['host' => $host, 'tenant' => $tenant, 'user' => $user] = enableProjectManagementForTests();

    tenancy()->initialize($tenant);
    $project = Project::query()->create(['title' => 'Move test', 'status' => 'active', 'created_by' => $user->id]);
    $task = ProjectTask::query()->create(['project_id' => $project->id, 'title' => 'Blocked item', 'status' => 'todo']);
    tenancy()->end();

    $this->post('http://'.$host.'/projects/'.$project->id.'/tasks/'.$task->id.'/move', [
        'status' => 'blocked',
        'position' => 0,
    ], ['Accept' => 'application/json'])->assertOk();

    tenancy()->initialize($tenant);
    expect($task->fresh()->status)->toBe('blocked');
    tenancy()->end();
});
