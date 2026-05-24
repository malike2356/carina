<?php

declare(strict_types=1);

use App\Models\Tenant\Document;
use App\Models\Tenant\Project;

it('attaches and detaches a vault document', function (): void {
    ['host' => $host, 'tenant' => $tenant, 'user' => $user] = enableProjectManagementForTests();

    tenancy()->initialize($tenant);
    $project = Project::query()->create(['title' => 'Doc project', 'status' => 'planning', 'created_by' => $user->id]);
    $document = Document::query()->create([
        'created_by' => $user->id,
        'title' => 'Planning PDF',
        'category' => 'general',
        'file_path' => 'documents/plan.pdf',
        'original_filename' => 'plan.pdf',
        'mime_type' => 'application/pdf',
        'size_bytes' => 512,
    ]);
    tenancy()->end();

    $this->post('http://'.$host.'/projects/'.$project->id.'/documents', [
        'document_id' => $document->id,
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    expect($project->fresh()->documents()->whereKey($document->id)->exists())->toBeTrue();
    tenancy()->end();

    $this->delete('http://'.$host.'/projects/'.$project->id.'/documents/'.$document->id)->assertRedirect();

    tenancy()->initialize($tenant);
    expect($project->fresh()->documents()->whereKey($document->id)->exists())->toBeFalse();
    tenancy()->end();
});
