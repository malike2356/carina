# Sprint: Carina Document Upload via Chat

**Status: COMPLETED 2026-07-26**

**What was built:**
- Implemented and archived

> Shared preflight: read `README.md` in this folder before implementing. Target `/opt/lampp/htdocs/verlox/propreneur/propreneur-v2`. Verify existing Laravel models, migrations, dispatcher, prompt registry, tenant boundaries, and tests before using any code snippet. Treat snippets as implementation sketches, not blind copy/paste.

## What This Builds

When a user sends a photo or PDF to Carina via chat (Telegram/WhatsApp/web), Carina identifies which property it belongs to, categorizes the document type, stores it, and updates compliance tracking. No dashboard. No menus. Just "Carina, here's the gas certificate for flat 4."

## Prerequisites

- Propreneur v2 running at `/opt/lampp/htdocs/verlox/propreneur/propreneur-v2`
- Carina agent service, tool dispatcher, and tool handler pattern already in place
- `Property`, `PropertyDocument`, and `ComplianceRecord` models exist (verify before building)
- File storage configured (local disk or S3)

## Architecture

```
User sends file to Carina (Telegram/WhatsApp/web)
 -> Carina receives file + caption "gas certificate for flat 4"
 -> Carina calls attach_document tool:
 1. Resolves "flat 4" to a Property model
 2. Detects document type from caption or content
 3. Stores file in storage/app/documents/{tenant_id}/{property_id}/
 4. Creates PropertyDocument record
 5. If it's a compliance document, updates ComplianceRecord
 6. Returns confirmation with property name and document type
```

## Part 1: Files to Create

### 1.1 Tool Handler

Create `app/Services/Carina/ToolHandlers/DocumentUploadHandler.php`:

```php
<?php

declare(strict_types=1);

namespace App\Services\Carina\ToolHandlers;

use App\Models\Tenant\Property;
use App\Models\Tenant\PropertyDocument;
use App\Models\Tenant\ComplianceRecord;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaConversation;
use App\Services\Carina\ToolResult;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

final class DocumentUploadHandler extends AbstractModuleToolHandler
{
  protected array $tools = [
    'attach_document',
    'list_property_documents',
    'check_compliance_expiry',
  ];

  public function __construct() {}

  public function handle(string $name, array $args, ?User $user, CarinaConversation $conversation): ToolResult
  {
    try {
      return match ($name) {
        'attach_document' => $this->attachDocument($args, $user),
        'list_property_documents' => $this->listDocuments($args, $user),
        'check_compliance_expiry' => $this->checkExpiry($args, $user),
        default => $this->fail('Unsupported tool.'),
      };
    } catch (\Throwable $e) {
      return $this->fail($e->getMessage(), 'execution_error');
    }
  }

  /**
  * Attach a document to a property. Carina receives the file from the chat platform,
  * and the file path/URL is passed in args.
  */
  private function attachDocument(array $args, ?User $user): ToolResult
  {
    $propertyRef = $args['property_reference'] ?? null;
    $documentType = $args['document_type'] ?? null;
    $filePath = $args['file_path'] ?? null;
    $fileName = $args['file_name'] ?? 'document';
    $notes = $args['notes'] ?? null;

    if (!$propertyRef || !$filePath) {
      return $this->fail('Property reference and file path are required.');
    }

    // Resolve property - by ID, address, or nickname
    $property = $this->resolveProperty($propertyRef, $user);
    if (!$property) {
      return $this->fail("Could not find property matching '{$propertyRef}'. Try the full address or property ID.");
    }

    // Detect document type if not specified
    if (!$documentType) {
      $documentType = $this->detectDocumentType($fileName, $notes ?? '');
    }

    // Store the file
    $tenantId = tenant('id');
    $storagePath = "documents/{$tenantId}/{$property->id}/" . Str::uuid() . '_' . Str::slug($fileName);

    // file_path is either a local temp path or a URL Carina downloaded
    if (filter_var($filePath, FILTER_VALIDATE_URL)) {
      $contents = file_get_contents($filePath);
      Storage::disk('public')->put($storagePath, $contents);
    } elseif (file_exists($filePath)) {
      Storage::disk('public')->put($storagePath, file_get_contents($filePath));
    } else {
      return $this->fail('Cannot access the uploaded file. Please try uploading again.');
    }

    // Create document record
    $document = PropertyDocument::create([
        'property_id' => $property->id,
        'name' => $fileName,
        'type' => $documentType,
        'storage_path' => $storagePath,
        'disk' => 'public',
        'notes' => $notes,
        'uploaded_by_user_id' => $user?->id,
    ]);

    // If it's a compliance document, create or update compliance record
    if ($this->isComplianceDocument($documentType)) {
      $this->updateComplianceRecord($property, $documentType, $notes);
    }

    return $this->success([
        'document_id' => $document->id,
        'property' => $property->address_line_1 ?? $property->name,
        'document_type' => $documentType,
        'file_name' => $fileName,
        'message' => "Document '{$fileName}' attached to {$property->address_line_1} as {$documentType}.",
    ]);
  }

  /**
  * List documents for a property.
  */
  private function listDocuments(array $args, ?User $user): ToolResult
  {
    $propertyRef = $args['property_reference'] ?? null;
    if (!$propertyRef) {
      return $this->fail('Property reference is required. Use the property address or ID.');
    }

    $property = $this->resolveProperty($propertyRef, $user);
    if (!$property) {
      return $this->fail("Could not find property matching '{$propertyRef}'.");
    }

    $documents = $property->documents()
    ->latest()
    ->get()
    ->map(fn($doc) => [
        'id' => $doc->id,
        'name' => $doc->name,
        'type' => $doc->type,
        'uploaded_at' => $doc->created_at->toDateString(),
        'url' => Storage::disk('public')->url($doc->storage_path),
    ]);

    return $this->success([
        'property' => $property->address_line_1 ?? $property->name,
        'document_count' => $documents->count(),
        'documents' => $documents->toArray(),
    ]);
  }

  /**
  * Check compliance documents expiring within a timeframe.
  */
  private function checkExpiry(array $args, ?User $user): ToolResult
  {
    $days = (int) ($args['days'] ?? 30);
    $propertyRef = $args['property_reference'] ?? null;

    $query = ComplianceRecord::query()
    ->where('expiry_date', '<=', now()->addDays($days))
    ->where('expiry_date', '>=', now());

    if ($propertyRef) {
      $property = $this->resolveProperty($propertyRef, $user);
      if ($property) {
        $query->where('property_id', $property->id);
      }
    }

    $expiring = $query->with('property')->get();

    $items = $expiring->map(fn($r) => [
        'property' => $r->property?->address_line_1 ?? 'Unknown',
        'type' => $r->type,
        'expires' => $r->expiry_date->toDateString(),
        'days_remaining' => (int) now()->diffInDays($r->expiry_date, false),
        'status' => $r->expiry_date->isPast() ? 'expired' : 'expiring',
    ]);

    return $this->success([
        'expiring_count' => $expiring->count(),
        'items' => $items->toArray(),
        'message' => $expiring->count() > 0
        ? "{$expiring->count()} compliance document(s) expiring within {$days} days."
        : "No compliance documents expiring within {$days} days.",
    ]);
  }

  // -- Helpers ----------------------------------------------

  private function resolveProperty(string $ref, ?User $user): ?Property
  {
    // Try by ID
    if (is_numeric($ref)) {
      return Property::find($ref);
    }

    // Try by address (partial match)
    $property = Property::where('address_line_1', 'like', "%{$ref}%")
    ->orWhere('address_line_2', 'like', "%{$ref}%")
    ->orWhere('city', 'like', "%{$ref}%")
    ->orWhere('postcode', 'like', "%{$ref}%")
    ->first();

    return $property;
  }

  private function detectDocumentType(string $fileName, string $notes): string
  {
    $combined = strtolower($fileName . ' ' . $notes);

    $patterns = [
      'gas_safety' => ['gas safety', 'gas certificate', 'cp12', 'gas safe'],
      'epc' => ['epc', 'energy performance', 'energy certificate'],
      'eicr' => ['eicr', 'electrical', 'electrical safety', 'electrical certificate'],
      'fire_risk' => ['fire risk', 'fire safety', 'fire alarm'],
      'tenancy_agreement' => ['tenancy', 'ast', 'tenancy agreement', 'lease'],
      'inventory' => ['inventory', 'check-in', 'check-out'],
      'insurance' => ['insurance', 'landlord insurance', 'building insurance'],
      'mortgage' => ['mortgage', 'mortgage statement'],
      'receipt' => ['receipt', 'invoice', 'bill'],
      'photo' => ['photo', 'image', 'picture', 'jpg', 'png'],
    ];

    foreach ($patterns as $type => $keywords) {
      foreach ($keywords as $keyword) {
        if (str_contains($combined, $keyword)) {
          return $type;
        }
      }
    }

    return 'other';
  }

  private function isComplianceDocument(string $type): bool
  {
    return in_array($type, ['gas_safety', 'epc', 'eicr', 'fire_risk', 'insurance']);
  }

  private function updateComplianceRecord(Property $property, string $type, ?string $notes): void
  {
    // Try to extract expiry date from notes (e.g. "expires 2027-03-15")
    $expiryDate = null;
    if ($notes) {
      if (preg_match('/expir(?:es|y|ation)\s*(?:date)?\s*:?\s*(\d{4}-\d{2}-\d{2})/i', $notes, $m)) {
        $expiryDate = $m[1];
      }
    }

    $compliance = ComplianceRecord::updateOrCreate(
      [
        'property_id' => $property->id,
        'type' => $type,
      ],
      [
        'status' => 'valid',
        'last_checked_at' => now(),
        'expiry_date' => $expiryDate,
        'notes' => $notes,
      ]
    );
  }
}
```

## Part 2: Files to Modify

### 2.1 Register Handler in Dispatcher

In `app/Services/Carina/CarinaModuleToolDispatcher.php`:

Add import at top:
```php
use App\Services\Carina\ToolHandlers\DocumentUploadHandler;
```

Add to constructor params:
```php
DocumentUploadHandler $documentUpload,
```

Add to `$this->handlers` array:
```php
$documentUpload,
```

### 2.2 Add Prompt to Library

In `brain/prompts/carina_extended/carina-assistant-prompts.php`, add before the closing `];`:

```php
'document_upload' => <<<'PROMPT'
You help users manage property documents via conversation.

DOCUMENT UPLOAD:
When a user sends a file (photo, PDF) with a description, use attach_document:
- property_reference: The address, nickname, or ID of the property (e.g. "flat 4", "106 Chichester Road")
- file_path: The URL or path to the uploaded file
- file_name: The original filename
- document_type: (optional) Type of document. If not provided, you must DETECT it from the file name and user's description.
- notes: (optional) Any additional notes, especially expiry dates.

DOCUMENT TYPES YOU CAN DETECT:
- gas_safety: Gas Safety Certificate (CP12)
- epc: Energy Performance Certificate
- eicr: Electrical Installation Condition Report
- fire_risk: Fire Risk Assessment
- tenancy_agreement: Tenancy Agreement / AST
- inventory: Check-in or Check-out Inventory
- insurance: Landlord or Building Insurance
- mortgage: Mortgage Statement
- receipt: Invoice or Receipt
- photo: Property Photo
- other: If you cannot determine the type

COMPLIANCE:
After attaching a compliance document (gas_safety, epc, eicr, fire_risk, insurance):
- If the user mentions an expiry date, PASS IT IN NOTES as "expires YYYY-MM-DD"
- Inform the user that the compliance tracker has been updated

LISTING DOCUMENTS:
Use list_property_documents to show all documents for a property.

COMPLIANCE CHECK:
Use check_compliance_expiry to find documents expiring soon.
- days: How many days to look ahead (default 30)
- property_reference: (optional) Filter to one property

CONVERSATION PATTERN:
User: "Here's the gas certificate for 106 Chichester Road, expires 2027-03-15" [sends PDF]
You: [call attach_document with property_reference="106 Chichester Road", document_type="gas_safety", notes="expires 2027-03-15"]
You: "Gas Safety Certificate attached to 106 Chichester Road. Expiry set to 15 March 2027. I'll remind you 30 days before."

PROPERTY RESOLUTION:
When the user says "flat 4", "my Bristol property", or "106 Chichester", pass that exact text as property_reference. The system resolves it to the correct property.
PROMPT,
```

## Part 3: Verification

After building, verify:
- [ ] `php -l app/Services/Carina/ToolHandlers/DocumentUploadHandler.php` passes
- [ ] Handler is imported, constructor param added, and array entry added in dispatcher
- [ ] Prompt is added to `carina-assistant-prompts.php` and `php -l` passes on that file
- [ ] `attach_document` resolves properties by partial address
- [ ] `attach_document` detects document type from filename + description
- [ ] `attach_document` handles both local file paths and URLs
- [ ] Compliance records update when compliance document is uploaded
- [ ] `list_property_documents` returns documents for a property
- [ ] `check_compliance_expiry` returns expiring documents within timeframe
- [ ] No hardcoded names, times, or values in source code
- [ ] File permissions are 644 after deploy

## Files Summary

| File | Action |
|------|--------|
| `app/Services/Carina/ToolHandlers/DocumentUploadHandler.php` | CREATE |
| `app/Services/Carina/CarinaModuleToolDispatcher.php` | MODIFY |
| `brain/prompts/carina_extended/carina-assistant-prompts.php` | MODIFY |
