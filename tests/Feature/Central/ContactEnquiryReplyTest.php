<?php

declare(strict_types=1);

use App\Mail\Central\ContactEnquiryReplyMail;
use App\Models\Central\ContactEnquiry;
use App\Models\Central\PlatformUser;
use Illuminate\Support\Facades\Mail;

it('sends enquiry reply synchronously to the contact email', function (): void {
    Mail::fake();

    $admin = PlatformUser::factory()->superAdmin()->create();
    $enquiry = ContactEnquiry::query()->create([
        'contact_name' => 'Laud Gablah',
        'contact_email' => 'contact@example.com',
        'message' => 'I need Enterprise White-label for my business',
    ]);

    $this->actingAs($admin, 'platform')
        ->post(route('admin.enquiries.reply', $enquiry), [
            'reply_from_name' => 'Laud Paul',
            'reply_body' => 'Thanks for reaching out — we will follow up shortly.',
        ])
        ->assertRedirect(route('admin.enquiries.show', $enquiry))
        ->assertSessionHas('status');

    $enquiry->refresh();
    expect($enquiry->reply_body)->toBe('Thanks for reaching out — we will follow up shortly.')
        ->and($enquiry->reply_from_name)->toBe('Laud Paul')
        ->and($enquiry->replied_at)->not->toBeNull();

    Mail::assertSent(ContactEnquiryReplyMail::class, function (ContactEnquiryReplyMail $mail) use ($enquiry): bool {
        return $mail->hasTo($enquiry->contact_email)
            && $mail->enquiry->is($enquiry);
    });

    Mail::assertNotQueued(ContactEnquiryReplyMail::class);
});

it('shows an error when the mail transport throws', function (): void {
    Mail::shouldReceive('to')
        ->once()
        ->andReturnSelf();
    Mail::shouldReceive('send')
        ->once()
        ->andThrow(new RuntimeException('Resend domain not verified'));

    $admin = PlatformUser::factory()->superAdmin()->create();
    $enquiry = ContactEnquiry::query()->create([
        'contact_name' => 'Laud Gablah',
        'contact_email' => 'contact@example.com',
        'message' => 'Hello',
    ]);

    $this->actingAs($admin, 'platform')
        ->from(route('admin.enquiries.show', $enquiry))
        ->post(route('admin.enquiries.reply', $enquiry), [
            'reply_from_name' => 'Laud Paul',
            'reply_body' => 'This should fail at send time.',
        ])
        ->assertRedirect(route('admin.enquiries.show', $enquiry))
        ->assertSessionHas('error');
});
