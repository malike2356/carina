<?php

declare(strict_types=1);

use App\Models\Central\OutgoingEmailLog;
use App\Models\Central\PlatformUser;

it('platform admin can view outgoing email log index', function (): void {
    OutgoingEmailLog::query()->create([
        'mailer' => 'smtp',
        'subject' => 'Test subject',
        'to_addresses' => 'user@example.test',
        'context' => 'system',
        'status' => 'sent',
        'sent_at' => now(),
    ]);

    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->get(route('admin.outgoing-emails.index'))
        ->assertOk()
        ->assertSee('user@example.test', false)
        ->assertSee('Test subject', false);
});
