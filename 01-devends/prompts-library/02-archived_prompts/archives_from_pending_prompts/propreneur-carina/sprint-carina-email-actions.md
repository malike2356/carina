# Sprint: Carina Email Ingestion Actions

**Status: COMPLETED 2026-07-26**

**What was built:**
- Implemented and archived

> Shared preflight: read `README.md` in this folder before implementing. Target `/opt/lampp/htdocs/verlox/propreneur/propreneur-v2`. Verify existing Laravel models, migrations, dispatcher, prompt registry, tenant boundaries, and tests before using any code snippet. Treat snippets as implementation sketches, not blind copy/paste.

## What This Builds

Carina reads incoming emails from agents, solicitors, tenants, and banks - then acts on them automatically. She classifies, stores documents, updates records, and flags items needing attention. The user reviews her actions in a morning digest instead of reading every email.

Currently: emails are classified and routed but Carina doesn't act on them. This sprint closes the loop.

## Prerequisites

- Propreneur v2 running at `/opt/lampp/htdocs/verlox/propreneur/propreneur-v2`
- The document upload, tenant communication, property operations, and deal analysis sprints must be complete
- `EmailIngestionConfig` model exists (IMAP credentials per tenant)
- Email ingestion pipeline exists (routes emails to conversations)
- Document upload handler exists, from `sprint-carina-document-upload.md`, because email attachments need to be stored

## Architecture

```
Email arrives from letting agent
 -> Email ingestion pipeline classifies: "compliance_document"
 -> Carina reads the email body and attachment
 -> Carina calls auto_process_email:
 1. Extracts property reference from subject/body
 2. Detects document type
 3. Stores attachment via DocumentUploadHandler
 4. Updates compliance record
 5. Creates a digest item for landlord review

Landlord receives morning digest:
 "Morning. 3 emails processed while you were away:
 - Gas certificate for 106 Chichester Road -> Attached. Expires 2027-03-15.
 - Maintenance request from tenant at flat 4 -> Flagged for review.
 - Mortgage statement from Halifax -> Filed in documents."

Landlord: "Show me the maintenance request"
Carina: [shows the email]
Landlord: "Reply and schedule an inspection"
Carina: [drafts reply via TenantCommunicationHandler]
```

## Part 1: Email Action Classifier

Carina needs to know what actions to take per email category. This goes in the prompt library as a system prompt.

But first, the tool handler.

Create `app/Services/Carina/ToolHandlers/EmailActionHandler.php`:

```php
<?php

declare(strict_types=1);

namespace App\Services\Carina\ToolHandlers;

use App\Models\Tenant\Property;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaConversation;
use App\Services\Carina\ToolResult;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

final class EmailActionHandler extends AbstractModuleToolHandler
{
  protected array $tools = [
    'auto_process_email',
    'email_digest',
    'flag_email_for_review',
    'search_emails',
  ];

  public function __construct(
    private readonly DocumentUploadHandler $documentUpload,
  ) {}

  public function handle(string $name, array $args, ?User $user, CarinaConversation $conversation): ToolResult
  {
    try {
      return match ($name) {
        'auto_process_email' => $this->autoProcess($args, $user),
        'email_digest' => $this->dailyDigest($user),
        'flag_email_for_review' => $this->flagForReview($args, $user),
        'search_emails' => $this->searchEmails($args),
        default => $this->fail('Unsupported tool.'),
      };
    } catch (\Throwable $e) {
      return $this->fail($e->getMessage(), 'execution_error');
    }
  }

  /**
  * Auto-process an incoming email. Carina reads it, extracts what matters,
  * and takes the appropriate action based on classification.
  */
  private function autoProcess(array $args, ?User $user): ToolResult
  {
    $emailId = $args['email_id'] ?? null;
    $subject = $args['subject'] ?? '';
    $body = $args['body'] ?? '';
    $from = $args['from'] ?? '';
    $classification = $args['classification'] ?? 'general';
    $attachments = $args['attachments'] ?? [];
    $propertyRef = $args['property_reference'] ?? null;

    // Try to identify property from subject/body if not provided
    if (!$propertyRef) {
      $propertyRef = $this->extractPropertyReference($subject, $body);
    }

    $property = null;
    if ($propertyRef) {
      $property = Property::where('address_line_1', 'like', "%{$propertyRef}%")
      ->orWhere('postcode', 'like', "%{$propertyRef}%")
      ->first();
    }

    $actions = [];

    // Determine action based on classification
    switch ($classification) {
      case 'compliance_document':
      // Auto-attach compliance documents
      foreach ($attachments as $attachment) {
        $docType = $this->detectDocType($subject . ' ' . $body);
        if ($property) {
          // Call DocumentUploadHandler to store
          $result = $this->documentUpload->handle('attach_document', [
              'property_reference' => (string) $property->id,
              'file_path' => $attachment['path'],
              'file_name' => $attachment['name'],
              'document_type' => $docType,
              'notes' => "Auto-processed from email: {$subject}",
            ], $user, new CarinaConversation());

          $actions[] = [
            'type' => 'document_attached',
            'document_type' => $docType,
            'property' => $property->address_line_1,
            'file' => $attachment['name'],
            'action_taken' => $result->success ? 'attached' : 'failed',
          ];
        } else {
          $actions[] = [
            'type' => 'needs_review',
            'reason' => 'Could not identify property',
            'file' => $attachment['name'],
            'subject' => $subject,
          ];
        }
      }
      break;

      case 'maintenance_request':
      $actions[] = [
        'type' => 'flagged',
        'category' => 'maintenance',
        'property' => $property?->address_line_1 ?? 'Unknown property',
        'summary' => Str::limit($body, 200),
        'action_required' => 'Review maintenance request and schedule response.',
      ];
      break;

      case 'tenant_communication':
      $actions[] = [
        'type' => 'flagged',
        'category' => 'tenant_message',
        'from' => $from,
        'property' => $property?->address_line_1 ?? 'Unknown property',
        'summary' => Str::limit($body, 200),
        'action_required' => 'Tenant message needs response. Use draft_tenant_message to reply.',
      ];
      break;

      case 'bank_statement':
      case 'mortgage':
      // Store financial documents
      foreach ($attachments as $attachment) {
        if ($property) {
          $this->documentUpload->handle('attach_document', [
              'property_reference' => (string) $property->id,
              'file_path' => $attachment['path'],
              'file_name' => $attachment['name'],
              'document_type' => 'mortgage',
              'notes' => "Auto-processed: {$subject}",
            ], $user, new CarinaConversation());

          $actions[] = [
            'type' => 'document_attached',
            'document_type' => 'mortgage',
            'property' => $property->address_line_1,
            'file' => $attachment['name'],
          ];
        }
      }
      break;

      case 'legal':
      case 'solicitor':
      $actions[] = [
        'type' => 'flagged',
        'category' => 'legal',
        'from' => $from,
        'summary' => Str::limit($body, 300),
        'action_required' => 'Legal communication - review immediately.',
        'priority' => 'high',
      ];
      break;

      case 'agent_communication':
      $actions[] = [
        'type' => 'flagged',
        'category' => 'agent_message',
        'from' => $from,
        'property' => $property?->address_line_1 ?? 'Unknown',
        'summary' => Str::limit($body, 200),
        'action_required' => 'Message from letting agent. Review and respond if needed.',
      ];
      break;

      case 'payment_receipt':
      // Try to extract payment amount from email
      $amount = $this->extractAmount($body);
      $actions[] = [
        'type' => 'payment_detected',
        'from' => $from,
        'amount' => $amount,
        'property' => $property?->address_line_1 ?? 'Unknown',
        'action_required' => $amount
        ? "Payment of £{$amount} detected. Record with record_payment if confirmed."
        : 'Payment receipt received. Review and record manually.',
      ];
      break;

      default:
      // General - file for review if it looks important
      if (strlen($body) > 50) {
        $actions[] = [
          'type' => 'filed',
          'category' => 'general',
          'summary' => Str::limit($body, 200),
        ];
      }
      break;
    }

    // Store processed email actions for digest
    $this->storeDigestItem($emailId, $classification, $actions, $subject, $from);

    return $this->success([
        'email_id' => $emailId,
        'classification' => $classification,
        'actions' => $actions,
        'action_count' => count($actions),
        'message' => "Email processed. " . count($actions) . " action(s) taken.",
    ]);
  }

  /**
  * Generate a daily digest of all processed and flagged emails.
  */
  private function dailyDigest(?User $user): ToolResult
  {
    // Fetch unread digest items from the last 24 hours
    $digestItems = \App\Models\Tenant\EmailDigestItem::where('created_at', '>=', now()->subHours(24))
    ->where('reviewed', false)
    ->orderBy('priority', 'desc')
    ->orderBy('created_at', 'desc')
    ->get();

    if ($digestItems->isEmpty()) {
      return $this->success([
          'message' => 'No unprocessed emails in the last 24 hours.',
          'items' => [],
      ]);
    }

    $items = $digestItems->map(fn($item) => [
        'id' => $item->id,
        'subject' => $item->subject,
        'from' => $item->from,
        'classification' => $item->classification,
        'actions' => json_decode($item->actions_json, true),
        'priority' => $item->priority,
        'time' => $item->created_at->diffForHumans(),
    ]);

    $highPriority = $digestItems->where('priority', 'high')->count();
    $needsReview = $digestItems->where('classification', '!=', 'general')->count();

    return $this->success([
        'total_processed' => $digestItems->count(),
        'needs_review' => $needsReview,
        'high_priority' => $highPriority,
        'items' => $items->toArray(),
        'message' => "{$digestItems->count()} emails processed in the last 24 hours. {$needsReview} need your review. {$highPriority} are high priority.",
    ]);
  }

  /**
  * Flag a specific email for manual review.
  */
  private function flagForReview(array $args, ?User $user): ToolResult
  {
    $emailId = $args['email_id'] ?? null;
    $reason = $args['reason'] ?? 'Manual review requested';

    if (!$emailId) {
      return $this->fail('Email ID is required.');
    }

    $this->storeDigestItem($emailId, 'flagged', [['type' => 'manual_review', 'reason' => $reason]], 'Flagged email', '');

    return $this->success([
        'email_id' => $emailId,
        'message' => 'Email flagged for manual review.',
    ]);
  }

  /**
  * Search processed emails by keyword.
  */
  private function searchEmails(array $args): ToolResult
  {
    $query = $args['query'] ?? '';
    $classification = $args['classification'] ?? null;
    $limit = (int) ($args['limit'] ?? 10);

    if (empty($query) && !$classification) {
      return $this->fail('Search query or classification is required.');
    }

    $dbQuery = \App\Models\Tenant\EmailDigestItem::query();

    if ($query) {
      $dbQuery->where(function ($q) use ($query) {
          $q->where('subject', 'like', "%{$query}%")
          ->orWhere('from', 'like', "%{$query}%")
          ->orWhere('actions_json', 'like', "%{$query}%");
      });
    }

    if ($classification) {
      $dbQuery->where('classification', $classification);
    }

    $results = $dbQuery->latest()->limit($limit)->get();

    return $this->success([
        'query' => $query,
        'results' => $results->map(fn($item) => [
            'id' => $item->id,
            'subject' => $item->subject,
            'from' => $item->from,
            'classification' => $item->classification,
            'date' => $item->created_at->toDateString(),
            'actions' => json_decode($item->actions_json, true),
        ])->toArray(),
        'total' => $results->count(),
    ]);
  }

  // -- Helpers ----------------------------------------------

  private function extractPropertyReference(string $subject, string $body): ?string
  {
    $text = $subject . ' ' . $body;

    // Match address-like patterns
    $patterns = [
      '/\b(\d+)\s+([A-Za-z]+(?:\s+[A-Za-z]+)*)\s+(?:road|street|avenue|lane|close|drive|way|place)\b/i',
      '/property:\s*([^,\n]+)/i',
      '/re:\s*([^,\n]+)/i',
    ];

    foreach ($patterns as $pattern) {
      if (preg_match($pattern, $text, $m)) {
        return trim($m[1] . ' ' . ($m[2] ?? ''));
      }
    }

    return null;
  }

  private function detectDocType(string $text): string
  {
    $lower = strtolower($text);
    return match (true) {
      str_contains($lower, 'gas') || str_contains($lower, 'cp12') => 'gas_safety',
      str_contains($lower, 'epc') || str_contains($lower, 'energy') => 'epc',
      str_contains($lower, 'eicr') || str_contains($lower, 'electrical') => 'eicr',
      str_contains($lower, 'fire') => 'fire_risk',
      str_contains($lower, 'mortgage') || str_contains($lower, 'halifax') || str_contains($lower, 'barclays') || str_contains($lower, 'natwest') => 'mortgage',
      default => 'other',
    };
  }

  private function extractAmount(string $text): ?float
  {
    if (preg_match('/£\s*([\d,]+(?:\.\d{2})?)/', $text, $m)) {
      return (float) str_replace(',', '', $m[1]);
    }
    return null;
  }

  private function storeDigestItem(?string $emailId, string $classification, array $actions, string $subject, string $from): void
  {
    $priority = 'normal';
    foreach ($actions as $action) {
      if (($action['priority'] ?? '') === 'high' || ($action['action_required'] ?? '') === 'Legal communication - review immediately.') {
        $priority = 'high';
        break;
      }
    }

    if ($emailId) {
      \App\Models\Tenant\EmailDigestItem::updateOrCreate(
        ['email_id' => $emailId],
        [
          'subject' => $subject,
          'from' => $from,
          'classification' => $classification,
          'actions_json' => json_encode($actions),
          'priority' => $priority,
          'reviewed' => false,
        ]
      );
    }
  }
}
```

## Part 2: Email Digest Model and Migration

Create `database/migrations/tenant/XXXX_create_email_digest_items_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
  public function up(): void
  {
    Schema::create('email_digest_items', function (Blueprint $table) {
        $table->id();
        $table->string('email_id')->nullable()->unique();
        $table->string('subject')->nullable();
        $table->string('from')->nullable();
        $table->string('classification')->default('general');
        $table->json('actions_json')->nullable();
        $table->string('priority')->default('normal');
        $table->boolean('reviewed')->default(false);
        $table->timestamp('reviewed_at')->nullable();
        $table->timestamps();
    });
  }

  public function down(): void
  {
    Schema::dropIfExists('email_digest_items');
  }
};
```

Create `app/Models/Tenant/EmailDigestItem.php`:

```php
<?php

declare(strict_types=1);

namespace App\Models\Tenant;

use Illuminate\Database\Eloquent\Model;

class EmailDigestItem extends Model
{
  protected $fillable = [
    'email_id',
    'subject',
    'from',
    'classification',
    'actions_json',
    'priority',
    'reviewed',
    'reviewed_at',
  ];

  protected $casts = [
    'reviewed' => 'boolean',
    'reviewed_at' => 'datetime',
  ];

  public function markReviewed(): void
  {
    $this->update([
        'reviewed' => true,
        'reviewed_at' => now(),
    ]);
  }
}
```

## Part 3: Registration

### 3.1 Register in Dispatcher

In `app/Services/Carina/CarinaModuleToolDispatcher.php`:

```php
use App\Services\Carina\ToolHandlers\EmailActionHandler;

// Constructor - after DocumentUploadHandler:
EmailActionHandler $emailAction,

// Handlers array:
$emailAction,
```

### 3.2 Prompt Library Addition

```php
'email_actions' => <<<'PROMPT'
You process incoming emails for property landlords. You read, classify, and act - the landlord reviews your work in a daily digest.

-- AUTO-PROCESSING EMAILS --
Use auto_process_email when an email arrives:
- email_id: Unique identifier for the email
- subject: Email subject line
- body: Email body text
- from: Sender email address
- classification: One of the categories below
- attachments: Array of {path, name} for each attachment
- property_reference: (optional) If you can identify the property

EMAIL CLASSIFICATIONS AND ACTIONS:
- compliance_document: Auto-attach to property. Update compliance tracker.
- maintenance_request: Flag for landlord review. Alert if urgent.
- tenant_communication: Flag for response. Suggest reply.
- bank_statement / mortgage: Auto-file under property documents.
- legal / solicitor: HIGH PRIORITY. Flag immediately for review.
- agent_communication: Flag for review.
- payment_receipt: Extract amount. Flag for payment recording.
- general: File if substantive. Skip if spam/trivial.

PROPERTY IDENTIFICATION:
Extract property reference from subject/body. Look for:
- Full addresses: "106 Chichester Road"
- Flat references: "Flat 4", "Unit 3"
- Postcodes
- Property names

-- DAILY DIGEST --
Use email_digest each morning to show unprocessed emails.
Present clearly:
- How many processed
- How many need review
- High priority items first
- What actions were taken automatically

Example digest:
"Morning. 4 emails processed since yesterday:
[HIGH] Solicitor - Completion documents for 106 Chichester Road -> Review immediately
[DONE] Gas certificate for flat 4 -> Attached. Expires 2027-03-15.
[FLAGGED] Maintenance request from tenant at 106 Chichester -> Boiler issue. Needs response.
[FILED] Mortgage statement from Halifax -> Stored under 106 Chichester."

-- SEARCHING EMAILS --
Use search_emails:
- query: Keyword search across subjects and senders
- classification: Filter by type
- limit: Max results (default 10)

-- FLAGGING --
Use flag_email_for_review for emails that don't fit the standard classifications:
- email_id: Email identifier
- reason: Why it needs manual review

AUTO-PROCESS SAFETY RULES:
- NEVER send replies automatically. Only draft for landlord approval.
- NEVER delete emails. Only process and flag.
- If property cannot be identified, file as "needs review" - don't guess.
- Legal and solicitor emails are ALWAYS flagged high priority - never auto-action.
- Extracted payment amounts are suggestions only. Landlord must confirm.
PROMPT,
```

## Part 4: Verification

- [ ] Migration creates `email_digest_items` table
- [ ] `php -l` passes on handler and model
- [ ] Handler registered in dispatcher (import + param + array)
- [ ] `auto_process_email` correctly classifies and acts per category
- [ ] Compliance documents auto-attach to properties
- [ ] Maintenance requests flagged with summary
- [ ] Legal emails flagged as high priority
- [ ] Payment amounts extracted from email body
- [ ] `email_digest` returns unread items in correct order
- [ ] `search_emails` finds by keyword and classification
- [ ] Property reference extracted from subject/body patterns
- [ ] No hardcoded names, times, or values
- [ ] 644 permissions after deploy

## Files Summary

| File | Action |
|------|--------|
| `database/migrations/tenant/XXXX_create_email_digest_items_table.php` | CREATE |
| `app/Models/Tenant/EmailDigestItem.php` | CREATE |
| `app/Services/Carina/ToolHandlers/EmailActionHandler.php` | CREATE |
| `app/Services/Carina/CarinaModuleToolDispatcher.php` | MODIFY |
| `brain/prompts/carina_extended/carina-assistant-prompts.php` | MODIFY |
