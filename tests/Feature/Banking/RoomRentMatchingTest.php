<?php

declare(strict_types=1);

use App\Models\Tenant\BankTransaction;
use App\Models\Tenant\BankTransactionRoomMatch;
use App\Models\Tenant\GlAccount;
use App\Models\Tenant\Property;
use App\Models\Tenant\PropertyTenancy;
use App\Models\Tenant\Room;
use App\Models\Tenant\TenancyRentPayment;
use App\Models\Tenant\User;
use App\Services\Accounting\ChartOfAccountsService;
use App\Services\Properties\HmoRentMatchingService;
use App\Services\Properties\RoomService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Carbon;

beforeEach(function (): void {
    static $sharedTenant = null;
    static $sharedUser = null;

    if ($sharedTenant === null) {
        $sharedTenant = app(TenantCreationService::class)->createTenant([
            'company_name' => 'Rent Match Shared',
            'owner_name' => 'Owner',
            'owner_email' => 'rent-match-shared@test.test',
            'plan' => 'starter',
            'send_welcome_email' => false,
        ]);
        $sharedUser = User::query()->where('email', $sharedTenant->owner_email)->firstOrFail();
    }

    $this->tenant = $sharedTenant;
    $this->user = $sharedUser;
    tenancy()->initialize($this->tenant);

    BankTransactionRoomMatch::query()->delete();
    BankTransaction::query()->delete();
    TenancyRentPayment::query()->delete();
    PropertyTenancy::query()->delete();
    Room::query()->forceDelete();
    Property::query()->delete();

    GlAccount::query()->delete();
    app(ChartOfAccountsService::class)->ensureDefaultAccounts();
});

afterEach(function (): void {
    if (tenancy()->initialized) {
        tenancy()->end();
    }
});

function rentMatchHmoSetup(User $user): array
{
    $property = Property::query()->create([
        'address_line1' => '1 Match Street',
        'city' => 'Leeds',
        'postcode' => 'LS1 1AA',
        'property_type' => 'hmo',
        'strategy' => 'hmo',
        'status' => 'managing',
        'created_by' => $user->id,
    ]);

    $room = app(RoomService::class)->createRoom($property, [
        'name' => 'Room A',
        'status' => 'occupied',
        'rent_pcm' => 600,
    ], $user->id);

    $tenancy = PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'room_id' => $room->id,
        'tenant_name' => 'Jane Smith',
        'rent_amount' => 600,
        'rent_due_day' => 1,
        'start_date' => now()->subMonths(2)->toDateString(),
        'tenancy_type' => 'ast',
    ]);

    $bank = GlAccount::query()->where('code', '1000')->firstOrFail();

    return compact('property', 'room', 'tenancy', 'bank');
}

it('scores exact amount on rent due day at eighty or above', function (): void {
    ['tenancy' => $tenancy, 'bank' => $bank] = rentMatchHmoSetup($this->user);

    $dueDate = now()->startOfMonth()->day(1);
    $transaction = BankTransaction::query()->create([
        'gl_account_id' => $bank->id,
        'transaction_date' => $dueDate->toDateString(),
        'description' => 'Standing order',
        'amount_minor' => 60000,
        'status' => 'unmatched',
        'source' => 'csv',
    ]);

    $matches = app(HmoRentMatchingService::class)->suggestRoomMatches($transaction);

    expect($matches)->not->toBeEmpty()
        ->and($matches[0]['tenancy_id'])->toBe((int) $tenancy->id)
        ->and($matches[0]['score'])->toBeGreaterThanOrEqual(80);
});

it('scores lower when amount is four pounds off but due date matches', function (): void {
    ['tenancy' => $tenancy, 'bank' => $bank] = rentMatchHmoSetup($this->user);

    $dueDate = now()->startOfMonth()->day(1);
    $transaction = BankTransaction::query()->create([
        'gl_account_id' => $bank->id,
        'transaction_date' => $dueDate->toDateString(),
        'description' => 'Rent',
        'amount_minor' => 60400,
        'status' => 'unmatched',
        'source' => 'csv',
    ]);

    $exact = app(HmoRentMatchingService::class)->suggestRoomMatches(
        BankTransaction::query()->create([
            'gl_account_id' => $bank->id,
            'transaction_date' => $dueDate->toDateString(),
            'description' => 'Rent',
            'amount_minor' => 60000,
            'status' => 'unmatched',
            'source' => 'csv',
        ])
    );

    $off = app(HmoRentMatchingService::class)->suggestRoomMatches($transaction);

    expect($off)->not->toBeEmpty()
        ->and($off[0]['tenancy_id'])->toBe((int) $tenancy->id)
        ->and($off[0]['score'])->toBeLessThan($exact[0]['score'])
        ->and($off[0]['score'])->toBeLessThan(80);
});

it('confirming a match records history and marks rent payment paid', function (): void {
    ['room' => $room, 'tenancy' => $tenancy, 'bank' => $bank] = rentMatchHmoSetup($this->user);

    $dueDate = now()->startOfMonth()->day(1);
    $payment = TenancyRentPayment::query()->create([
        'tenancy_id' => $tenancy->id,
        'property_id' => $tenancy->property_id,
        'amount_minor' => 60000,
        'due_date' => $dueDate->toDateString(),
        'status' => 'pending',
        'created_by' => $this->user->id,
    ]);

    $transaction = BankTransaction::query()->create([
        'gl_account_id' => $bank->id,
        'transaction_date' => $dueDate->toDateString(),
        'description' => 'J SMITH rent',
        'amount_minor' => 60000,
        'status' => 'unmatched',
        'source' => 'csv',
    ]);

    app(HmoRentMatchingService::class)->confirmRoomMatch(
        $transaction,
        $this->user,
        (int) $room->id,
        (int) $tenancy->id,
        90,
        true,
    );

    expect(BankTransactionRoomMatch::query()->where('bank_transaction_id', $transaction->id)->exists())->toBeTrue()
        ->and($payment->fresh()->status)->toBe('paid')
        ->and($transaction->fresh()->status)->toBe('matched');
});

it('does not suggest another tenant when payer name matches only one occupant', function (): void {
    $property = Property::query()->create([
        'address_line1' => '2 Tenant Lane',
        'city' => 'Leeds',
        'postcode' => 'LS2 2BB',
        'property_type' => 'hmo',
        'strategy' => 'hmo',
        'status' => 'managing',
        'created_by' => $this->user->id,
    ]);

    $roomAlice = app(RoomService::class)->createRoom($property, ['name' => 'Room 1', 'status' => 'occupied'], $this->user->id);
    $roomBob = app(RoomService::class)->createRoom($property, ['name' => 'Room 2', 'status' => 'occupied'], $this->user->id);

    $alice = PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'room_id' => $roomAlice->id,
        'tenant_name' => 'Alice Jones',
        'rent_amount' => 600,
        'rent_due_day' => 1,
        'start_date' => now()->subMonth()->toDateString(),
    ]);

    PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'room_id' => $roomBob->id,
        'tenant_name' => 'Bob Williams',
        'rent_amount' => 650,
        'rent_due_day' => 1,
        'start_date' => now()->subMonth()->toDateString(),
    ]);

    $bank = GlAccount::query()->where('code', '1000')->firstOrFail();
    $dueDate = Carbon::parse(now()->format('Y-m').'-01');

    $transaction = BankTransaction::query()->create([
        'gl_account_id' => $bank->id,
        'transaction_date' => $dueDate->toDateString(),
        'description' => 'ALICE JONES SO',
        'amount_minor' => 60000,
        'status' => 'unmatched',
        'source' => 'csv',
    ]);

    $matches = app(HmoRentMatchingService::class)->suggestRoomMatches($transaction);

    expect($matches)->toHaveCount(1)
        ->and($matches[0]['tenancy_id'])->toBe((int) $alice->id);
});
