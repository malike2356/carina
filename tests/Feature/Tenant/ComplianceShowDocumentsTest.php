<?php

declare(strict_types=1);

use App\Models\Tenant\ComplianceItem;
use App\Models\Tenant\Property;
use App\Models\Tenant\PropertyDocument;
use App\Models\Tenant\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\URL;

beforeEach(function (): void {
    URL::defaults(['tenant_subdomain' => 'fixturetenant']);

    $authUser = new User([
        'name' => 'Fixture User',
        'email' => 'fixture@example.test',
    ]);
    $authUser->id = 1;
    $authUser->exists = true;
    test()->actingAs($authUser, 'web');
});

it('renders compliance show with issued_at, vault links, and property documents', function (): void {
    $property = new Property([
        'address_line1' => '88 Vault Street',
        'city' => 'Manchester',
    ]);
    $property->id = 1;
    $property->exists = true;

    $item = new ComplianceItem([
        'title' => 'CP12 renewal',
        'category' => 'safety',
        'type' => 'gas_safety',
        'property_id' => 1,
        'reminder_days' => 30,
    ]);
    $item->id = 9;
    $item->exists = true;
    $item->setAttribute('issued_at', Carbon::parse('2025-06-01'));
    $item->setAttribute('expires_at', Carbon::parse('2027-06-01'));
    $item->setRelation('property', $property);

    $doc = new PropertyDocument([
        'property_id' => 1,
        'name' => 'Gas cert scan.pdf',
    ]);
    $doc->id = 2;
    $doc->exists = true;

    $html = view('tenant.compliance.show', [
        'item' => $item,
        'propertyDocuments' => collect([$doc]),
        'vaultDocuments' => collect(),
        'carinaAiEnabled' => false,
    ])->render();

    expect($html)
        ->toContain('01 Jun 2025')
        ->toContain('Property documents')
        ->toContain('Gas cert scan.pdf')
        ->toContain('vault-documents')
        ->toContain('Download');
});

it('renders property show document vault block', function (): void {
    $property = new Property([
        'address_line1' => '12 Ledger Road',
        'city' => 'Leeds',
        'postcode' => 'LS11AA',
        'status' => 'owned',
        'strategy' => 'btl',
        'property_type' => 'house',
    ]);
    $property->id = 3;
    $property->exists = true;

    $doc = new PropertyDocument([
        'property_id' => 3,
        'name' => 'Tenancy agreement.pdf',
    ]);
    $doc->id = 4;
    $doc->exists = true;

    $html = view('tenant.properties.show', [
        'property' => $property,
        'metrics' => ['ltv' => 0, 'gross_yield' => 0, 'equity' => 0],
        'complianceItems' => collect(),
        'propertyDocuments' => collect([$doc]),
        'dealAnalyses' => collect(),
        'pipelineDeals' => collect(),
        'carinaAiEnabled' => false,
        'tenantNavModules' => [],
    ])->render();

    expect($html)
        ->toContain('id="vault-documents"')
        ->toContain('Document vault')
        ->toContain('Tenancy agreement.pdf');
});
