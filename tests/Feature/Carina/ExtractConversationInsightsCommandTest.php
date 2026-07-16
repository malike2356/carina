<?php

declare(strict_types=1);

use App\Models\Central\CarinaConversationInsight;
use App\Models\Central\CarinaExtractionLog;
use App\Models\Central\FeatureFlag;
use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\CarinaMessage;
use App\Models\Tenant\User;
use App\Services\Carina\Insights\InsightExtractionService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Facades\Artisan;
use Stancl\Tenancy\Facades\Tenancy;

beforeEach(function (): void {
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'carina_knowledge_mining')->update(['enabled' => true]);
});

it('dry run outputs conversation ids without storing anything', function (): void {
    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'Insights Dry '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@insights-dry.test',
        'plan' => 'starter',
    ]);

    Tenancy::initialize($tenant);
    $user = User::query()->firstOrFail();
    $conv = CarinaConversation::query()->create([
        'user_id' => $user->id,
        'tenant_id' => $tenant->getTenantKey(),
        'title' => 'Dry run thread',
        'metadata' => null,
    ]);
    $dt = now()->subDays(35);
    for ($i = 0; $i < 6; $i++) {
        $msg = CarinaMessage::query()->create([
            'carina_conversation_id' => $conv->id,
            'role' => $i % 2 === 0 ? 'user' : 'assistant',
            'content' => 'Message '.$i,
        ]);
        $msg->forceFill(['created_at' => $dt, 'updated_at' => $dt])->saveQuietly();
    }
    Tenancy::end();

    $exit = Artisan::call('carina:extract-conversation-insights', [
        '--tenant' => $tenant->slug,
        '--dry-run' => true,
    ]);

    expect($exit)->toBe(0)
        ->and(CarinaConversationInsight::query()->count())->toBe(0)
        ->and(CarinaExtractionLog::query()->count())->toBe(0);
});

it('skips conversations with fewer than minimum messages', function (): void {
    $mock = Mockery::mock(InsightExtractionService::class);
    $mock->shouldReceive('extractFromMessages')->never();
    app()->instance(InsightExtractionService::class, $mock);

    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'Insights Min '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@insights-min.test',
        'plan' => 'starter',
    ]);

    Tenancy::initialize($tenant);
    $user = User::query()->firstOrFail();
    $conv = CarinaConversation::query()->create([
        'user_id' => $user->id,
        'tenant_id' => $tenant->getTenantKey(),
        'title' => 'Short thread',
        'metadata' => null,
    ]);
    $dt = now()->subDays(35);
    for ($i = 0; $i < 4; $i++) {
        $msg = CarinaMessage::query()->create([
            'carina_conversation_id' => $conv->id,
            'role' => $i % 2 === 0 ? 'user' : 'assistant',
            'content' => 'm'.$i,
        ]);
        $msg->forceFill(['created_at' => $dt, 'updated_at' => $dt])->saveQuietly();
    }
    Tenancy::end();

    Artisan::call('carina:extract-conversation-insights', [
        '--tenant' => $tenant->slug,
    ]);

    expect(CarinaExtractionLog::query()->count())->toBe(0);
});

it('creates extraction log entry even when no insights found', function (): void {
    $mock = Mockery::mock(InsightExtractionService::class);
    $mock->shouldReceive('extractFromMessages')->once()->andReturn([]);
    app()->instance(InsightExtractionService::class, $mock);

    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'Insights None '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@insights-none.test',
        'plan' => 'starter',
    ]);

    Tenancy::initialize($tenant);
    $user = User::query()->firstOrFail();
    $conv = CarinaConversation::query()->create([
        'user_id' => $user->id,
        'tenant_id' => $tenant->getTenantKey(),
        'title' => 'Long thread',
        'metadata' => null,
    ]);
    $dt = now()->subDays(35);
    for ($i = 0; $i < 6; $i++) {
        $msg = CarinaMessage::query()->create([
            'carina_conversation_id' => $conv->id,
            'role' => $i % 2 === 0 ? 'user' : 'assistant',
            'content' => 'm'.$i,
        ]);
        $msg->forceFill(['created_at' => $dt, 'updated_at' => $dt])->saveQuietly();
    }
    Tenancy::end();

    Artisan::call('carina:extract-conversation-insights', [
        '--tenant' => $tenant->slug,
    ]);

    expect(CarinaExtractionLog::query()->where('extraction_status', 'none_found')->exists())->toBeTrue();
});
