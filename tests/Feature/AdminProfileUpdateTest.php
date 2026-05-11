<?php

declare(strict_types=1);

use App\Models\Central\PlatformUser;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

it('renders profile edit x-data without breaking on names that contain double quotes', function () {
    Storage::fake('public');

    $user = PlatformUser::factory()->superAdmin()->create([
        'name' => 'Say "Hello"',
    ]);

    $html = $this->actingAs($user, 'platform')
        ->get(route('admin.profile.edit'))
        ->assertOk()
        ->getContent();

    expect($html)->toContain('x-data="profileEditor(')
        ->and($html)->toContain('JSON.parse')
        ->and($html)->not->toContain('x-data="profileEditor({ name: "');
});

it('stores an uploaded avatar file and exposes a public storage URL', function () {
    Storage::fake('public');

    $user = PlatformUser::factory()->superAdmin()->create();

    $file = UploadedFile::fake()->image('photo.jpg', 600, 400);

    $this->actingAs($user, 'platform')
        ->put(route('admin.profile.update'), [
            'name' => $user->name,
            'email' => $user->email,
            'username' => $user->username ?? '',
            'avatar_url' => '',
            'avatar_file' => $file,
        ])
        ->assertRedirect();

    $user->refresh();

    expect($user->avatar)->not->toBeNull()
        ->and((string) $user->avatar)->toStartWith('avatars/platform/'.$user->id.'/')
        ->and((string) $user->avatar_url)->toContain('storage/avatars/platform/'.$user->id.'/');

    Storage::disk('public')->assertExists((string) $user->avatar);
});

it('clears avatar when remove_avatar is submitted and deletes local storage file', function () {
    Storage::fake('public');

    $user = PlatformUser::factory()->superAdmin()->create([
        'avatar' => 'avatars/platform/99/test.webp',
    ]);
    Storage::disk('public')->put($user->avatar, 'fake-webp-bytes');

    $payload = [
        'name' => $user->name,
        'email' => $user->email,
        'username' => $user->username,
        'avatar_url' => '',
        'remove_avatar' => '1',
    ];

    $this->actingAs($user, 'platform')
        ->put(route('admin.profile.update'), $payload)
        ->assertRedirect();

    $user->refresh();

    expect($user->avatar)->toBeNull();
    Storage::disk('public')->assertMissing('avatars/platform/99/test.webp');
});

it('clears remote avatar URL without touching storage', function () {
    Storage::fake('public');

    $user = PlatformUser::factory()->superAdmin()->create([
        'avatar' => 'https://example.com/face.png',
    ]);

    $this->actingAs($user, 'platform')
        ->put(route('admin.profile.update'), [
            'name' => $user->name,
            'email' => $user->email,
            'username' => $user->username,
            'avatar_url' => '',
            'remove_avatar' => '1',
        ])
        ->assertRedirect();

    expect($user->fresh()->avatar)->toBeNull();
});
