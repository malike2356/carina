<?php

declare(strict_types=1);

use App\Models\Tenant\Project;
use App\Services\Projects\ProjectService;

it('rolls task costs into project actual_cost_minor', function (): void {
    ['host' => $host, 'tenant' => $tenant, 'user' => $user] = enableProjectManagementForTests();

    tenancy()->initialize($tenant);
    $project = Project::query()->create([
        'title' => 'Budget roll-up',
        'status' => 'active',
        'created_by' => $user->id,
        'budget_minor' => 1000000,
    ]);
    tenancy()->end();

    $this->post('http://'.$host.'/projects/'.$project->id.'/tasks', [
        'title' => 'Labour',
        'status' => 'done',
        'cost_minor' => 150000,
    ])->assertRedirect();

    $this->post('http://'.$host.'/projects/'.$project->id.'/tasks', [
        'title' => 'Materials',
        'status' => 'in_progress',
        'cost_minor' => 250000,
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $project->refresh();
    expect($project->actual_cost_minor)->toBe(400000);
    $stats = app(ProjectService::class)->projectStats($project);
    expect($stats['budget_remaining_minor'])->toBe(600000);
    tenancy()->end();
});
