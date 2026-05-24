<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\User;
use App\Services\Documents\CertScanningService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\RateLimiter;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    config([
        'cert_scan.provider' => 'openai',
        'cert_scan.max_scans_per_hour' => 10,
        'ai.providers.openai.api_key' => 'test-key',
    ]);
});

it('scan endpoint returns extracted fields structure', function (): void {
    Http::fake([
        'https://api.openai.com/v1/chat/completions' => Http::response([
            'choices' => [[
                'message' => [
                    'content' => json_encode([
                        'certificate_type' => 'gas_safety',
                        'issued_at' => '2024-06-01',
                        'expires_at' => '2025-06-01',
                        'engineer_name' => 'Jane Gas Safe',
                        'reference_number' => 'CP12-9988',
                        'property_address' => '10 Test Lane, Leeds',
                    ]),
                ],
            ]],
            'usage' => ['prompt_tokens' => 100, 'completion_tokens' => 50],
        ]),
    ]);

    $file = UploadedFile::fake()->image('cert.jpg', 400, 600);
    $result = app(CertScanningService::class)->scan($file, 'tenant-test');

    expect($result['certificate_type'])->toBe('gas_safety')
        ->and($result['expires_at'])->toBe('2025-06-01')
        ->and($result['reference_number'])->toBe('CP12-9988')
        ->and($result['fields']['expires_at']['confidence'])->toBe('high')
        ->and($result['compliance_type'])->toBe('gas_safety');
});

it('low confidence fields are flagged in the response', function (): void {
    Http::fake([
        'https://api.openai.com/v1/chat/completions' => Http::response([
            'choices' => [[
                'message' => [
                    'content' => json_encode([
                        'certificate_type' => 'eicr',
                        'issued_at' => null,
                        'expires_at' => 'not-a-date',
                        'engineer_name' => null,
                        'reference_number' => null,
                        'property_address' => null,
                    ]),
                ],
            ]],
            'usage' => ['prompt_tokens' => 10, 'completion_tokens' => 10],
        ]),
    ]);

    $result = app(CertScanningService::class)->scan(
        UploadedFile::fake()->image('blur.jpg'),
        'tenant-test',
    );

    expect($result['fields']['issued_at']['confidence'])->toBe('low')
        ->and($result['fields']['expires_at']['confidence'])->toBe('low')
        ->and($result['overall_confidence'])->toBe('low');
});

it('rate limit returns 429 after ten scans in one hour', function (): void {
    Http::fake([
        'https://api.openai.com/v1/chat/completions' => Http::response([
            'choices' => [[
                'message' => [
                    'content' => json_encode([
                        'certificate_type' => 'epc',
                        'issued_at' => '2024-01-01',
                        'expires_at' => '2034-01-01',
                        'engineer_name' => null,
                        'reference_number' => 'EPC-1',
                        'property_address' => null,
                    ]),
                ],
            ]],
            'usage' => ['prompt_tokens' => 1, 'completion_tokens' => 1],
        ]),
    ]);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Cert Scan RL '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'cert-scan-'.uniqid().'@test.test',
        'plan' => 'starter',
        'send_welcome_email' => false,
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';
    $tenantKey = $tenant->getTenantKey();

    RateLimiter::clear('cert-scan:'.$tenantKey);

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    $user = User::query()->where('email', $tenant->owner_email)->firstOrFail();
    $user->forceFill(['password' => Hash::make('secret-scan')])->save();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $token = $this->postJson('http://'.$host.'/api/v1/mobile/auth/login', [
        'email' => $tenant->owner_email,
        'password' => 'secret-scan',
        'device_uuid' => 'ffffffff-7777-7777-7777-ffffffffffff',
    ])->assertOk()->json('access_token');

    $headers = ['Authorization' => 'Bearer '.$token];
    $payload = ['image' => UploadedFile::fake()->image('cert.jpg')];

    for ($i = 0; $i < 10; $i++) {
        $this->postJson('http://'.$host.'/api/v1/mobile/documents/scan-cert', $payload, $headers)
            ->assertOk()
            ->assertJsonStructure(['data' => ['fields', 'overall_confidence']]);
    }

    $this->postJson('http://'.$host.'/api/v1/mobile/documents/scan-cert', $payload, $headers)
        ->assertStatus(429);
});
