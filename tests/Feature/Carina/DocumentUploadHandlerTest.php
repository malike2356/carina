<?php

declare(strict_types=1);

use App\Models\Central\Tenant;
use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\ComplianceItem;
use App\Models\Tenant\Property;
use App\Models\Tenant\PropertyDocument;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaModuleToolDispatcher;
use App\Services\Carina\ToolHandlers\DocumentUploadHandler;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

/**
 * @return array{0: Tenant, 1: User}
 */
function documentUploadTenant(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Document Upload '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@docupload.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    return [$tenant, $user];
}

function documentUploadConversation(Tenant $tenant, User $user): CarinaConversation
{
    return CarinaConversation::query()->create([
        'tenant_id' => (string) $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Document upload test',
    ]);
}

function documentUploadProperty(User $user, string $address = '106 Chichester Road'): Property
{
    return Property::query()->create([
        'created_by' => $user->id,
        'address_line1' => $address,
        'city' => 'Portsmouth',
        'postcode' => 'PO4 0AA',
        'property_type' => 'flat',
        'bedrooms' => 2,
    ]);
}

it('attach_document stores file and updates compliance from local path', function (): void {
    [$tenant, $user] = documentUploadTenant();
    tenancy()->initialize($tenant);

    Storage::fake('local');

    $property = documentUploadProperty($user);
    $filePath = sys_get_temp_dir().'/gas_cert_'.uniqid().'.pdf';
    file_put_contents($filePath, '%PDF-1.4 gas safety certificate');

    $conversation = documentUploadConversation($tenant, $user);

    $result = app(DocumentUploadHandler::class)->handle(
        'attach_document',
        [
            'property_reference' => 'Chichester',
            'file_path' => $filePath,
            'file_name' => 'gas-certificate.pdf',
            'document_type' => 'gas_safety',
            'notes' => 'expires 2027-03-15',
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['document_type'])->toBe('gas_safety')
        ->and($result->data['property'])->toContain('106 Chichester Road');

    $document = PropertyDocument::query()->find($result->data['document_id']);
    expect($document)->not->toBeNull()
        ->and($document->property_id)->toBe($property->id)
        ->and($document->compliance_item_id)->not->toBeNull();

    $compliance = ComplianceItem::query()->find($document->compliance_item_id);
    expect($compliance)->not->toBeNull()
        ->and($compliance->type)->toBe('gas_safety')
        ->and($compliance->expires_at?->toDateString())->toBe('2027-03-15');

    @unlink($filePath);
    tenancy()->end();
});

it('attach_document detects document type from filename and notes', function (): void {
    [$tenant, $user] = documentUploadTenant();
    tenancy()->initialize($tenant);

    Storage::fake('local');

    documentUploadProperty($user);
    $filePath = sys_get_temp_dir().'/epc_'.uniqid().'.pdf';
    file_put_contents($filePath, 'epc content');

    $conversation = documentUploadConversation($tenant, $user);

    $result = app(DocumentUploadHandler::class)->handle(
        'attach_document',
        [
            'property_reference' => '106 Chichester',
            'file_path' => $filePath,
            'file_name' => 'energy-performance.pdf',
            'notes' => 'EPC rating C',
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['document_type'])->toBe('epc');

    @unlink($filePath);
    tenancy()->end();
});

it('attach_document fails when property cannot be resolved', function (): void {
    [$tenant, $user] = documentUploadTenant();
    tenancy()->initialize($tenant);

    $filePath = sys_get_temp_dir().'/missing_prop_'.uniqid().'.pdf';
    file_put_contents($filePath, 'content');

    $conversation = documentUploadConversation($tenant, $user);

    $result = app(DocumentUploadHandler::class)->handle(
        'attach_document',
        [
            'property_reference' => 'No Such Address',
            'file_path' => $filePath,
            'file_name' => 'doc.pdf',
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeFalse()
        ->and($result->summary)->toContain('Could not find property');

    @unlink($filePath);
    tenancy()->end();
});

it('list_property_documents returns latest document heads for a property', function (): void {
    [$tenant, $user] = documentUploadTenant();
    tenancy()->initialize($tenant);

    $property = documentUploadProperty($user);
    $root = PropertyDocument::query()->create([
        'property_id' => $property->id,
        'name' => 'Gas Certificate v1',
        'path' => "properties/{$property->id}/documents/v1.pdf",
        'type' => 'gas_safety',
        'uploaded_by' => $user->id,
        'version' => 1,
        'root_document_id' => null,
    ]);
    $root->update(['root_document_id' => $root->id]);

    PropertyDocument::query()->create([
        'property_id' => $property->id,
        'name' => 'Gas Certificate v2',
        'path' => "properties/{$property->id}/documents/v2.pdf",
        'type' => 'gas_safety',
        'uploaded_by' => $user->id,
        'version' => 2,
        'root_document_id' => $root->id,
    ]);

    $conversation = documentUploadConversation($tenant, $user);

    $result = app(DocumentUploadHandler::class)->handle(
        'list_property_documents',
        ['property_reference' => (string) $property->id],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['document_count'])->toBe(1)
        ->and($result->data['documents'][0]['name'])->toBe('Gas Certificate v2');

    tenancy()->end();
});

it('check_compliance_expiry returns items within timeframe', function (): void {
    [$tenant, $user] = documentUploadTenant();
    tenancy()->initialize($tenant);

    $property = documentUploadProperty($user);
    ComplianceItem::query()->create([
        'property_id' => $property->id,
        'created_by' => $user->id,
        'category' => 'safety',
        'type' => 'gas_safety',
        'title' => 'Gas Safety Certificate',
        'expires_at' => now()->addDays(12),
        'status' => 'valid',
    ]);

    $conversation = documentUploadConversation($tenant, $user);

    $result = app(DocumentUploadHandler::class)->handle(
        'check_compliance_expiry',
        ['days' => 30, 'property_reference' => 'Chichester'],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['expiring_count'])->toBe(1)
        ->and($result->data['items'][0]['type'])->toBe('gas_safety');

    tenancy()->end();
});

it('dispatches attach_document via CarinaModuleToolDispatcher', function (): void {
    [$tenant, $user] = documentUploadTenant();
    tenancy()->initialize($tenant);

    Storage::fake('local');

    documentUploadProperty($user);
    $filePath = sys_get_temp_dir().'/dispatch_doc_'.uniqid().'.pdf';
    file_put_contents($filePath, 'dispatch test');

    app()->forgetInstance(CarinaModuleToolDispatcher::class);

    $conversation = documentUploadConversation($tenant, $user);

    $result = app(CarinaModuleToolDispatcher::class)->dispatch(
        'attach_document',
        [
            'property_reference' => '106 Chichester Road',
            'file_path' => $filePath,
            'file_name' => 'inventory.pdf',
            'document_type' => 'inventory',
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['document_type'])->toBe('inventory');

    @unlink($filePath);
    tenancy()->end();
});

it('attach_document downloads file from URL', function (): void {
    [$tenant, $user] = documentUploadTenant();
    tenancy()->initialize($tenant);

    Storage::fake('local');

    documentUploadProperty($user);
    $fileUrl = 'https://cdn.example.test/gas-cert.pdf';

    Http::fake([
        $fileUrl => Http::response('%PDF gas certificate', 200),
    ]);

    $conversation = documentUploadConversation($tenant, $user);

    $result = app(DocumentUploadHandler::class)->handle(
        'attach_document',
        [
            'property_reference' => 'Chichester',
            'file_path' => $fileUrl,
            'file_name' => 'gas-cert.pdf',
            'document_type' => 'gas_safety',
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and(PropertyDocument::query()->count())->toBe(1);

    tenancy()->end();
});
