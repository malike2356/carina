<?php

declare(strict_types=1);

use App\Models\Tenant\Project;

it('creates updates archives and soft-deletes a project', function (): void {
    ['host' => $host, 'user' => $user] = enableProjectManagementForTests();

    $this->post('http://'.$host.'/projects', [
        'title' => 'Extension programme',
        'type' => 'development',
        'status' => 'active',
        'priority' => 'high',
        'budget_minor' => 800000,
    ])->assertRedirect();

    $project = Project::query()->where('title', 'Extension programme')->firstOrFail();
    expect($project->status)->toBe('active');
    expect($project->priority)->toBe('high');
    expect($project->owner_user_id)->toBe($user->id);

    $this->get('http://'.$host.'/projects/'.$project->id)->assertOk()->assertSee('Extension programme', false);

    $this->put('http://'.$host.'/projects/'.$project->id, [
        'title' => 'Extension programme v2',
        'type' => 'development',
        'status' => 'on_hold',
        'priority' => 'high',
    ])->assertRedirect();

    $project->refresh();
    expect($project->title)->toBe('Extension programme v2');
    expect($project->status)->toBe('on_hold');

    $this->post('http://'.$host.'/projects/'.$project->id.'/archive')->assertRedirect();
    $project->refresh();
    expect($project->archived_at)->not->toBeNull();

    $this->delete('http://'.$host.'/projects/'.$project->id)->assertRedirect();
    expect(Project::query()->whereKey($project->id)->exists())->toBeFalse();
    expect(Project::withTrashed()->whereKey($project->id)->exists())->toBeTrue();
});

it('filters projects by type on index', function (): void {
    ['host' => $host, 'tenant' => $tenant, 'user' => $user] = enableProjectManagementForTests();

    tenancy()->initialize($tenant);
    Project::query()->create(['title' => 'Refurb A', 'type' => 'refurb', 'status' => 'planning', 'created_by' => $user->id]);
    tenancy()->end();

    $this->get('http://'.$host.'/projects?type=refurb')
        ->assertOk()
        ->assertSee('Refurb A', false);
});
