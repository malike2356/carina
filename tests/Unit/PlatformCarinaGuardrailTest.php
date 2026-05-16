<?php

declare(strict_types=1);

use App\Services\Carina\Security\CarinaToolArgumentValidator;
use App\Services\Carina\Security\PlatformCarinaGuardrail;

it('allows all canonical platform tool names', function () {
    $guardrail = new PlatformCarinaGuardrail(new CarinaToolArgumentValidator);
    $allowed = [
        'platform_list_tenants', 'platform_get_tenant', 'platform_get_ai_usage', 'platform_list_feature_flags',
        'platform_get_subscription_summary', 'platform_search_platform_users', 'platform_get_tenant_ai_settings',
        'platform_get_platform_settings', 'platform_list_security_findings', 'platform_toggle_feature_flag',
    ];
    foreach ($allowed as $tool) {
        expect($guardrail->assertSafe($tool, [])->allowed)->toBeTrue();
    }
});

it('blocks an unknown tool name', function () {
    $guardrail = new PlatformCarinaGuardrail(new CarinaToolArgumentValidator);
    $result = $guardrail->assertSafe('list_all_secrets', []);
    expect($result->allowed)->toBeFalse();
});

it('blocks a destructive-sounding tool name', function () {
    $guardrail = new PlatformCarinaGuardrail(new CarinaToolArgumentValidator);
    $result = $guardrail->assertSafe('delete_tenant', ['id' => 5]);
    expect($result->allowed)->toBeFalse();
});
