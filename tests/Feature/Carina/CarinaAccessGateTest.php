<?php

declare(strict_types=1);

use App\Models\Tenant\TenantRole;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaAccessGate;
use App\Services\Tenancy\TenantCreationService;
use Database\Factories\Tenant\UserFactory;
use Illuminate\Support\Str;

/**
 * Integration test (tenant DB + roles). Lives under Feature so it shares the global
 * RefreshDatabase lifecycle with other tenancy tests; a Unit-scoped migrate:fresh could
 * leave RefreshDatabaseState inconsistent for the next class in the same run.
 */
it('enforces Carina access gate rules for tenant roles', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Gate '.Str::random(8),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.Str::random(8).'@gate.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    $assertRole = function (string $role, callable $assert): void {
        TenantRole::findOrCreate($role, 'web');

        /** @var User $user */
        $user = UserFactory::new()->createOne([]);
        $user->syncRoles([$role]);

        $gate = app(CarinaAccessGate::class);

        $assert($gate, $user);
    };

    $assertRole('investor', function (CarinaAccessGate $gate, User $user): void {
        expect($gate->canUseRag($user))->toBeFalse()
            ->and($gate->canUploadDocuments($user))->toBeFalse()
            ->and($gate->canAccessDealAnalysis($user))->toBeTrue();
    });

    $assertRole('property_manager', function (CarinaAccessGate $gate, User $user): void {
        expect($gate->canUseRag($user))->toBeTrue()
            ->and($gate->canUploadDocuments($user))->toBeTrue();
    });

    $assertRole('team_member', function (CarinaAccessGate $gate, User $user): void {
        expect($gate->canUseRag($user))->toBeFalse()
            ->and($gate->canPersistChatWrites($user))->toBeTrue();
    });

    $assertRole('mentor', function (CarinaAccessGate $gate, User $user): void {
        expect($gate->canPersistChatWrites($user))->toBeTrue()
            ->and($gate->canUseRag($user))->toBeFalse();
    });

    $assertRole('mentee', function (CarinaAccessGate $gate, User $user): void {
        expect($gate->canPersistChatWrites($user))->toBeFalse()
            ->and($gate->canReceiveFinancialOutputs($user))->toBeFalse();
    });

    $assertRole('viewer', function (CarinaAccessGate $gate, User $user): void {
        expect($gate->canPersistChatWrites($user))->toBeFalse()
            ->and($gate->canReceiveFinancialOutputs($user))->toBeFalse();
    });

    tenancy()->end();
});
