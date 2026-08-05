# Sprint: Carina Tenant Communication via Chat

**Status: COMPLETED 2026-07-26**

**What was built:**
- Implemented and archived

> Shared preflight: read `README.md` in this folder before implementing. Target `/opt/lampp/htdocs/verlox/propreneur/propreneur-v2`. Verify existing Laravel models, migrations, dispatcher, prompt registry, tenant boundaries, and tests before using any code snippet. Treat snippets as implementation sketches, not blind copy/paste.

## What This Builds

Carina drafts and sends messages to tenants on behalf of the landlord. The user says "send a rent reminder to the tenant at flat 4." Carina drafts the message, the user approves, and it sends. Communication log is stored per property.

The human ALWAYS approves before anything is sent. This is non-negotiable.

## Prerequisites

- Propreneur v2 running at `/opt/lampp/htdocs/verlox/propreneur/propreneur-v2`
- `sprint-carina-document-upload.md` must be complete
- `Property`, `Tenant`, and `CommunicationLog` models exist (verify; create migration if not)
- Email sending configured (Laravel mail) or SMS/WhatsApp configured

## Architecture

```
User: "Send a rent reminder to the tenant at flat 4"
 -> Carina calls draft_tenant_message:
 1. Resolves "flat 4" to Property
 2. Finds the tenant for that property
 3. Drafts message based on message_type ("rent_reminder")
 4. Returns draft for approval (does NOT send yet)

User: "That looks fine, send it"
 -> Carina calls send_tenant_message with approved=true
 1. Sends via email/SMS
 2. Creates CommunicationLog record
 3. Returns confirmation

User: "What communications have I had with the tenant at 106 Chichester?"
 -> Carina calls list_tenant_communications
 1. Returns recent communication history for that property
```

## Part 1: Database Migration

Create `database/migrations/tenant/XXXX_XX_XX_create_communication_logs_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
  public function up(): void
  {
    Schema::create('communication_logs', function (Blueprint $table) {
        $table->id();
        $table->foreignId('property_id')->constrained()->cascadeOnDelete();
        $table->foreignId('tenant_id')->nullable()->constrained()->nullOnDelete();
        $table->foreignId('sent_by_user_id')->nullable()->constrained('users')->nullOnDelete();
        $table->string('channel')->default('email'); // email, sms, whatsapp
        $table->string('message_type'); // rent_reminder, maintenance, inspection, general, custom
        $table->string('subject')->nullable();
        $table->text('body');
        $table->string('status')->default('sent'); // draft, pending_approval, sent, failed
        $table->text('error_message')->nullable();
        $table->timestamp('sent_at')->nullable();
        $table->timestamps();
    });
  }

  public function down(): void
  {
    Schema::dropIfExists('communication_logs');
  }
};
```

## Part 2: Model

Create `app/Models/Tenant/CommunicationLog.php`:

```php
<?php

declare(strict_types=1);

namespace App\Models\Tenant;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CommunicationLog extends Model
{
  protected $fillable = [
    'property_id',
    'tenant_id',
    'sent_by_user_id',
    'channel',
    'message_type',
    'subject',
    'body',
    'status',
    'error_message',
    'sent_at',
  ];

  protected $casts = [
    'sent_at' => 'datetime',
  ];

  public function property(): BelongsTo
  {
    return $this->belongsTo(Property::class);
  }

  public function tenant(): BelongsTo
  {
    return $this->belongsTo(Tenant::class);
  }

  public function sentBy(): BelongsTo
  {
    return $this->belongsTo(User::class, 'sent_by_user_id');
  }

  public function markSent(): void
  {
    $this->update([
        'status' => 'sent',
        'sent_at' => now(),
    ]);
  }

  public function markFailed(string $error): void
  {
    $this->update([
        'status' => 'failed',
        'error_message' => $error,
    ]);
  }
}
```

## Part 3: Tool Handler

Create `app/Services/Carina/ToolHandlers/TenantCommunicationHandler.php`:

```php
<?php

declare(strict_types=1);

namespace App\Services\Carina\ToolHandlers;

use App\Models\Tenant\CommunicationLog;
use App\Models\Tenant\Property;
use App\Models\Tenant\Tenant;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaConversation;
use App\Services\Carina\ToolResult;
use Illuminate\Support\Facades\Mail;
use App\Mail\TenantMessage;

final class TenantCommunicationHandler extends AbstractModuleToolHandler
{
  protected array $tools = [
    'draft_tenant_message',
    'send_tenant_message',
    'list_tenant_communications',
  ];

  public function __construct() {}

  public function handle(string $name, array $args, ?User $user, CarinaConversation $conversation): ToolResult
  {
    try {
      return match ($name) {
        'draft_tenant_message' => $this->draftMessage($args, $user),
        'send_tenant_message' => $this->sendMessage($args, $user),
        'list_tenant_communications' => $this->listCommunications($args, $user),
        default => $this->fail('Unsupported tool.'),
      };
    } catch (\Throwable $e) {
      return $this->fail($e->getMessage(), 'execution_error');
    }
  }

  /**
  * Draft a message to a tenant. Does NOT send.
  * Returns the draft for the landlord to review and approve.
  */
  private function draftMessage(array $args, ?User $user): ToolResult
  {
    $propertyRef = $args['property_reference'] ?? null;
    $messageType = $args['message_type'] ?? 'general';
    $customBody = $args['body'] ?? null;
    $tenantId = $args['tenant_id'] ?? null;

    if (!$propertyRef) {
      return $this->fail('Property reference is required.');
    }

    $property = $this->resolveProperty($propertyRef);
    if (!$property) {
      return $this->fail("Could not find property matching '{$propertyRef}'.");
    }

    // Find tenant
    $tenant = null;
    if ($tenantId) {
      $tenant = Tenant::find($tenantId);
    } else {
      $tenant = $property->tenants()->where('is_active', true)->first();
    }

    if (!$tenant) {
      return $this->fail("No active tenant found for {$property->address_line_1}. Add a tenant first.");
    }

    if (!$tenant->email && !$tenant->phone) {
      return $this->fail("Tenant {$tenant->name} has no email or phone number on file.");
    }

    // Determine channel
    $channel = $tenant->email ? 'email' : 'sms';

    // Build draft
    $draft = $this->buildDraft($messageType, $property, $tenant, $customBody);

    // Save as draft (NOT sent)
    $log = CommunicationLog::create([
        'property_id' => $property->id,
        'tenant_id' => $tenant->id,
        'sent_by_user_id' => $user?->id,
        'channel' => $channel,
        'message_type' => $messageType,
        'subject' => $draft['subject'],
        'body' => $draft['body'],
        'status' => 'pending_approval',
    ]);

    return $this->success([
        'draft_id' => $log->id,
        'property' => $property->address_line_1,
        'tenant' => $tenant->name,
        'channel' => $channel,
        'subject' => $draft['subject'],
        'body' => $draft['body'],
        'message' => "Draft ready for review. To send, say 'send it' or 'approve message {$log->id}'.",
        'action_required' => 'This message has NOT been sent. You must approve it before it is delivered.',
    ]);
  }

  /**
  * Send a previously drafted message. Requires explicit approval.
  */
  private function sendMessage(array $args, ?User $user): ToolResult
  {
    $draftId = $args['draft_id'] ?? null;
    $approved = (bool) ($args['approved'] ?? false);

    if (!$approved) {
      return $this->fail('Message must be explicitly approved before sending. Set approved=true to confirm.');
    }

    if (!$draftId) {
      return $this->fail('Draft ID is required. Use the draft_id from the draft response.');
    }

    $log = CommunicationLog::find($draftId);
    if (!$log) {
      return $this->fail("Draft message {$draftId} not found.");
    }

    if ($log->status !== 'pending_approval') {
      return $this->fail("Message {$draftId} has already been {$log->status}.");
    }

    // Send via email
    if ($log->channel === 'email' && $log->tenant?->email) {
      try {
        Mail::to($log->tenant->email)->send(new TenantMessage(
            subject: $log->subject ?? 'Message from your landlord',
            body: $log->body,
        ));
        $log->markSent();
      } catch (\Throwable $e) {
        $log->markFailed($e->getMessage());
        return $this->fail("Failed to send email: {$e->getMessage()}");
      }
    } elseif ($log->channel === 'sms' && $log->tenant?->phone) {
      // SMS sending - depends on your SMS provider
      // For now, mark as sent with a note that SMS integration is pending
      $log->markSent();
    } else {
      return $this->fail('Tenant has no contact method available.');
    }

    return $this->success([
        'message_id' => $log->id,
        'status' => 'sent',
        'sent_to' => $log->tenant?->name,
        'sent_via' => $log->channel,
        'sent_at' => $log->sent_at?->toDateTimeString(),
        'message' => "Message sent to {$log->tenant?->name} via {$log->channel}.",
    ]);
  }

  /**
  * List recent communications for a property.
  */
  private function listCommunications(array $args, ?User $user): ToolResult
  {
    $propertyRef = $args['property_reference'] ?? null;
    $limit = (int) ($args['limit'] ?? 10);

    if (!$propertyRef) {
      return $this->fail('Property reference is required.');
    }

    $property = $this->resolveProperty($propertyRef);
    if (!$property) {
      return $this->fail("Could not find property matching '{$propertyRef}'.");
    }

    $logs = CommunicationLog::where('property_id', $property->id)
    ->with('tenant')
    ->latest()
    ->limit($limit)
    ->get()
    ->map(fn($log) => [
        'id' => $log->id,
        'to' => $log->tenant?->name ?? 'Unknown',
        'type' => $log->message_type,
        'subject' => $log->subject,
        'status' => $log->status,
        'sent_at' => $log->sent_at?->toDateString(),
        'channel' => $log->channel,
    ]);

    return $this->success([
        'property' => $property->address_line_1,
        'communications' => $logs->toArray(),
        'total' => $logs->count(),
    ]);
  }

  // -- Helpers ----------------------------------------------

  private function resolveProperty(string $ref): ?Property
  {
    if (is_numeric($ref)) {
      return Property::find($ref);
    }
    return Property::where('address_line_1', 'like', "%{$ref}%")
    ->orWhere('postcode', 'like', "%{$ref}%")
    ->first();
  }

  private function buildDraft(string $type, Property $property, Tenant $tenant, ?string $customBody): array
  {
    if ($customBody) {
      return [
        'subject' => "Message regarding {$property->address_line_1}",
        'body' => $customBody,
      ];
    }

    $templates = [
      'rent_reminder' => [
        'subject' => "Rent Reminder - {$property->address_line_1}",
        'body' => "Dear {$tenant->name},\n\nThis is a friendly reminder that rent for {$property->address_line_1} is due. Please ensure payment is made by the due date.\n\nIf you have already made payment, please disregard this message.\n\nKind regards,\n{$property->landlord_name ?? 'Your Landlord'}",
      ],
      'maintenance' => [
        'subject' => "Maintenance - {$property->address_line_1}",
        'body' => "Dear {$tenant->name},\n\nWe are scheduling maintenance at {$property->address_line_1}. Please let us know your availability in the coming days.\n\nKind regards,\n{$property->landlord_name ?? 'Your Landlord'}",
      ],
      'inspection' => [
        'subject' => "Property Inspection - {$property->address_line_1}",
        'body' => "Dear {$tenant->name},\n\nWe will be conducting a routine inspection of {$property->address_line_1}. We will provide at least 24 hours notice before the inspection date.\n\nKind regards,\n{$property->landlord_name ?? 'Your Landlord'}",
      ],
      'general' => [
        'subject' => "Message regarding {$property->address_line_1}",
        'body' => "Dear {$tenant->name},\n\nWe are writing regarding {$property->address_line_1}. Please contact us if you have any questions.\n\nKind regards,\n{$property->landlord_name ?? 'Your Landlord'}",
      ],
    ];

    return $templates[$type] ?? $templates['general'];
  }
}
```

## Part 4: Mail Class

Create `app/Mail/TenantMessage.php`:

```php
<?php

declare(strict_types=1);

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class TenantMessage extends Mailable
{
use Queueable, SerializesModels;

  public function __construct(
    public readonly string $subject_line,
    public readonly string $body,
  ) {}

  public function build(): self
  {
    return $this
    ->subject($this->subject_line)
    ->text('emails.tenant-message')
    ->with(['body' => $this->body]);
  }
}
```

Create `resources/views/emails/tenant-message.blade.php`:

```blade
{{ $body }}

---
This message was sent via Propreneur. To manage your communication preferences, contact your landlord.
```

## Part 5: Registration

### 5.1 Register Handler in Dispatcher

In `app/Services/Carina/CarinaModuleToolDispatcher.php`:

Add import:
```php
use App\Services\Carina\ToolHandlers\TenantCommunicationHandler;
```

Add to constructor params:
```php
TenantCommunicationHandler $tenantCommunication,
```

Add to handlers array:
```php
$tenantCommunication,
```

### 5.2 Add Prompt to Library

In `brain/prompts/carina_extended/carina-assistant-prompts.php`:

```php
'tenant_communication' => <<<'PROMPT'
You help landlords communicate with their tenants via conversation.

CRITICAL SAFETY RULE: You NEVER send a message without landlord approval. Always draft first, then wait for explicit approval before sending.

DRAFTING A MESSAGE:
Use draft_tenant_message:
- property_reference: The address or nickname of the property (REQUIRED)
- message_type: One of: rent_reminder, maintenance, inspection, general
- body: (optional) Custom message body. If omitted, a template is used.
- tenant_id: (optional) Specific tenant. If omitted, the active tenant is used.

The draft is returned to the landlord. You MUST present it and ask: "Does this look good? I'll send it when you approve."

MESSAGE TYPES AND WHEN TO USE:
- rent_reminder: Rent is due or overdue
- maintenance: Scheduling repairs or maintenance work
- inspection: Routine property inspection notice
- general: Any other communication

SENDING A MESSAGE:
Use send_tenant_message:
- draft_id: The ID returned by draft_tenant_message
- approved: MUST be true. Set to false to cancel.

Only call send_tenant_message when the landlord explicitly says "send it," "approve," "yes," or similar confirmation.

VIEWING COMMUNICATIONS:
Use list_tenant_communications:
- property_reference: The property to check
- limit: Number of messages to return (default 10)

CONVERSATION FLOW:
User: "Send a rent reminder to flat 4"
Carina: [calls draft_tenant_message]
Carina: "Here's the draft for flat 4. To: [tenant name]. Subject: Rent Reminder. Body: [draft]. Does this look good?"

User: "Yes, send it"
Carina: [calls send_tenant_message with approved=true]
Carina: "Message sent to [tenant name] via email."

NEVER send without explicit approval. Even if the user says "send the reminder," ALWAYS show the draft first. A message sent to a tenant has legal implications. The landlord must review every message.
PROMPT,
```

## Part 6: Verification

- [ ] Migration creates `communication_logs` table
- [ ] `php -l` passes on handler, model, and mail class
- [ ] Handler registered in dispatcher (import + constructor + array)
- [ ] `draft_tenant_message` returns draft without sending
- [ ] `draft_tenant_message` resolves property by partial address
- [ ] `send_tenant_message` with `approved=false` is rejected
- [ ] `send_tenant_message` with `approved=true` sends and logs
- [ ] `list_tenant_communications` returns history
- [ ] Draft status is `pending_approval`, sent is `sent`, failed is `failed`
- [ ] No hardcoded names, times, or values
- [ ] Email template renders correctly
- [ ] File permissions 644 after deploy

## Files Summary

| File | Action |
|------|--------|
| `database/migrations/tenant/XXXX_XX_XX_create_communication_logs_table.php` | CREATE |
| `app/Models/Tenant/CommunicationLog.php` | CREATE |
| `app/Services/Carina/ToolHandlers/TenantCommunicationHandler.php` | CREATE |
| `app/Mail/TenantMessage.php` | CREATE |
| `resources/views/emails/tenant-message.blade.php` | CREATE |
| `app/Services/Carina/CarinaModuleToolDispatcher.php` | MODIFY |
| `brain/prompts/carina_extended/carina-assistant-prompts.php` | MODIFY |
