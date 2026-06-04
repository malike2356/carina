<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\User;
use App\Models\Tenant\Vcal\VcalIntakePool;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Tests\Concerns\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('renders intake pool edit page with stored questions', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Intake Pool '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@intake-pool.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'booking_calendar')->update(['enabled' => true]);

    $user = User::query()->firstOrFail();

    $pool = VcalIntakePool::query()->create([
        'user_id' => $user->id,
        'name' => 'Investor intake',
        'slug' => 'investor-intake',
        'questions' => [
            [
                'key' => 'budget',
                'label' => 'Rough budget',
                'type' => 'select',
                'required' => true,
                'choices' => ['Under £100k', '£100k-£250k'],
                'disqualify_values' => ['Under £100k'],
                'disqualify_message' => 'Not a fit for this programme.',
            ],
        ],
    ]);

    $poolId = (int) $pool->getKey();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $edit = $this->get('http://'.$host.'/vical/intake-pools/'.$poolId.'/edit');
    $edit->assertOk();
    $edit->assertSee('Investor intake', false);
    $edit->assertSee('Rough budget', false);
});
