# Sprint: Carina Admin - Stripe, Billing, and Workspace Team

**Status: COMPLETED 2026-07-26**

**What was built:**
- Implemented and archived

> Shared preflight: read `README.md` in this folder before implementing. Target `/opt/lampp/htdocs/verlox/propreneur/propreneur-v2`. Verify existing Laravel models, migrations, dispatcher, prompt registry, tenant boundaries, and tests before using any code snippet. Treat snippets as implementation sketches, not blind copy/paste.

## What This Builds

Carina handles Stripe subscription management and workspace team administration via chat. The landlord can check their plan, invite team members, and manage billing without touching the dashboard.

## Part 1: Handler

Create `app/Services/Carina/ToolHandlers/AdminHandler.php`:

```php
<?php

declare(strict_types=1);

namespace App\Services\Carina\ToolHandlers;

use App\Models\Tenant\User;
use App\Services\Carina\CarinaConversation;
use App\Services\Carina\ToolResult;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

final class AdminHandler extends AbstractModuleToolHandler
{
  protected array $tools = [
    'subscription_info',
    'invite_team_member',
    'list_team_members',
    'remove_team_member',
    'workspace_settings',
  ];

  public function __construct() {}

  public function handle(string $name, array $args, ?User $user, CarinaConversation $conversation): ToolResult
  {
    try {
      return match ($name) {
        'subscription_info' => $this->subscriptionInfo($user),
        'invite_team_member' => $this->inviteMember($args, $user),
        'list_team_members' => $this->listMembers(),
        'remove_team_member' => $this->removeMember($args),
        'workspace_settings' => $this->workspaceSettings(),
        default => $this->fail('Unsupported tool.'),
      };
    } catch (\Throwable $e) {
      return $this->fail($e->getMessage(), 'execution_error');
    }
  }

  private function subscriptionInfo(?User $user): ToolResult
  {
    $tenant = tenant();

    // Read from Stripe subscription or local plan record
    $plan = $tenant->subscription_plan ?? 'free';
    $status = $tenant->subscription_status ?? 'active';
    $nextBilling = $tenant->subscription_ends_at ?? null;

    $features = match ($plan) {
      'starter' => ['properties' => 5, 'tenants' => 10, 'documents' => 50, 'ai_messages' => 100, 'team_members' => 1],
      'professional' => ['properties' => 25, 'tenants' => 50, 'documents' => 250, 'ai_messages' => 500, 'team_members' => 5],
      'business' => ['properties' => 100, 'tenants' => 200, 'documents' => 'unlimited', 'ai_messages' => 'unlimited', 'team_members' => 20],
      default => ['properties' => 1, 'tenants' => 2, 'documents' => 10, 'ai_messages' => 20, 'team_members' => 1],
    };

    $usage = [
      'properties' => \App\Models\Tenant\Property::count(),
      'tenants' => \App\Models\Tenant\Tenant::where('is_active', true)->count(),
      'team_members' => User::count(),
    ];

    return $this->success([
        'plan' => $plan,
        'status' => $status,
        'next_billing' => $nextBilling,
        'features' => $features,
        'usage' => $usage,
        'upgrade_url' => config('app.url') . '/pricing',
        'message' => "You're on the {$plan} plan." . ($nextBilling ? " Next billing: {$nextBilling}." : ""),
    ]);
  }

  private function inviteMember(array $args, ?User $user): ToolResult
  {
    $email = $args['email'] ?? null;
    $name = $args['name'] ?? null;
    $role = $args['role'] ?? 'member'; // admin, member, viewer

    if (!$email || !$name) return $this->fail('Email and name required.');

    if (User::where('email', $email)->exists()) {
      return $this->fail("{$email} is already a workspace member.");
    }

    $tempPassword = Str::random(16);
    $member = User::create([
        'name' => $name,
        'email' => $email,
        'password' => Hash::make($tempPassword),
        'role' => $role,
    ]);

    // Send invitation email
    \Illuminate\Support\Facades\Mail::to($email)->send(new \App\Mail\WorkspaceInvitation($member, $tempPassword));

    return $this->success([
        'member_id' => $member->id,
        'name' => $name,
        'email' => $email,
        'role' => $role,
        'message' => "{$name} invited to workspace as {$role}. They'll receive an email with login instructions.",
    ]);
  }

  private function listMembers(): ToolResult
  {
    $members = User::all()->map(fn($u) => [
        'id' => $u->id, 'name' => $u->name, 'email' => $u->email, 'role' => $u->role ?? 'member',
        'joined' => $u->created_at->toDateString(),
    ]);

    return $this->success(['members' => $members->toArray(), 'total' => $members->count()]);
  }

  private function removeMember(array $args): ToolResult
  {
    $email = $args['email'] ?? null;
    if (!$email) return $this->fail('Email required.');
    $member = User::where('email', $email)->first();
    if (!$member) return $this->fail("No member with email {$email}.");
    $member->delete();
    return $this->success(['message' => "{$email} removed from workspace."]);
  }

  private function workspaceSettings(): ToolResult
  {
    return $this->success([
        'workspace_name' => tenant('name'),
        'created' => tenant('created_at'),
        'settings_url' => config('app.url') . '/settings',
        'message' => 'Workspace settings are available in the dashboard.',
    ]);
  }
}
```

## Part 2: Invitation Mail

Create `app/Mail/WorkspaceInvitation.php`:

```php
<?php
namespace App\Mail;
use Illuminate\Mail\Mailable;

class WorkspaceInvitation extends Mailable
{
  public function __construct(public $user, public string $tempPassword) {}

  public function build(): self
  {
    return $this->subject('You have been invited to Propreneur')
    ->markdown('emails.workspace-invitation', [
        'name' => $this->user->name,
        'email' => $this->user->email,
        'password' => $this->tempPassword,
        'login_url' => config('app.url') . '/login',
    ]);
  }
}
```

## Part 3: Registration and Prompt

```php
'admin' => <<<'PROMPT'
You handle workspace administration and billing.

-- SUBSCRIPTION --
Use subscription_info to show current plan, features, usage, and upgrade options.

-- TEAM --
Use invite_team_member to add members (admin, member, viewer roles).
Use list_team_members to see everyone.
Use remove_team_member to revoke access.
Use workspace_settings for workspace overview.

-- UPGRADING --
When a landlord hits usage limits, proactively suggest upgrading. Direct them to the pricing page.
PROMPT,
```

## Verification

- [ ] subscription_info shows plan + usage + upgrade URL
- [ ] invite_team_member creates user + sends invitation email
- [ ] list_team_members returns all workspace members
- [ ] remove_team_member deletes user by email
- [ ] Standard registration

## Files Summary

| File | Action |
|------|--------|
| `app/Services/Carina/ToolHandlers/AdminHandler.php` | CREATE |
| `app/Mail/WorkspaceInvitation.php` | CREATE |
| `resources/views/emails/workspace-invitation.blade.php` | CREATE |
| `app/Services/Carina/CarinaModuleToolDispatcher.php` | MODIFY |
| `brain/prompts/carina_extended/carina-assistant-prompts.php` | MODIFY |
