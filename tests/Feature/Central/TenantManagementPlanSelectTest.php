<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\PlatformUser;
use App\Models\Central\SubscriptionPlan;
use App\Models\Central\Tenant;
use Illuminate\Support\Str;

beforeEach(function () {
    FeatureFlag::query()->where('key', 'saas_tenant_management')->update(['enabled' => true]);
});

it('shows subscription catalogue plan names on tenant edit', function () {
    SubscriptionPlan::on('central')->updateOrCreate(
        ['slug' => 'mentor_network'],
        [
            'name' => 'Mentor Network',
            'price' => '299.00',
            'currency' => 'GBP',
            'interval' => 'month',
            'features' => ['display_name' => 'Mentor Network', 'modules' => [], 'limits' => []],
            'is_active' => true,
            'sort_order' => 30,
        ]
    );

    $tenant = Tenant::withoutEvents(fn () => Tenant::on('central')->create([
        'id' => (string) Str::uuid(),
        'slug' => 'plan-select-test',
        'company_name' => 'Plan Select Test Ltd',
        'owner_name' => 'Owner',
        'owner_email' => 'owner-plan-select@example.test',
        'plan' => 'mentor_network',
        'is_active' => true,
        'trial_ends_at' => now()->addDays(7),
    ]));
    $tenant->domains()->create(['domain' => 'plan-select-test']);

    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->get(route('admin.saas-tenancy.edit', $tenant))
        ->assertOk()
        ->assertSee('Mentor Network')
        ->assertSeeHtml('value="mentor_network"');
});
