# Carina AI - Coding Philosophy & Standards

---

## The Principles

### Clean Code
Code that reads like well-written prose. Every function, variable, and class name tells you what it does without needing a comment. A function should fit on one screen. A class should have one responsibility. If you need to add a comment to explain what a block of code does, extract it into a function with that name.

```php
// Failed:  Not clean
if ($a->status === 1 && $b->type === 'investor' && $c->created_at > now()->subDays(30)) {
    // do something
}

// Done:  Clean
if ($user->isActiveInvestor() && $user->joinedWithinLast(30)) {
    $this->sendWelcomeOffer($user);
}
```

**Rules:**
- Functions under 20 lines. If it's longer, it's doing too much.
- Classes under 200 lines. If it's longer, split it.
- One level of indentation per function. If you need nested conditionals, extract.
- No magic numbers. Use named constants or enums.
- No commented-out code. Delete it. Git has the history.

---

### Reusable Data Structures
Build once, use everywhere. DTOs (Data Transfer Objects) over raw arrays. Value objects over primitive types. If the same shape of data appears in two places, it gets a named structure.

```php
// Failed:  Raw array - fragile, no type safety, undocumented
['name' => 'John', 'email' => 'john@test.com', 'type' => 'investor'];

// Done:  DTO - typed, documented, reusable everywhere
class ContactData
{
    public function __construct(
        public readonly string $name,
        public readonly string $email,
        public readonly ContactType $type,
    ) {}
}
```

**Rules:**
- DTOs over arrays for any structured data passed between systems.
- Value objects for domain concepts (Postcode, Money, EmailAddress, PhoneNumber).
- Enums over string constants for any fixed set of values.
- If you write the same array shape twice, extract a DTO.
- If you validate the same field twice, centralise the validation.

```php
// Value objects carry their own validation
class Postcode
{
    public function __construct(public readonly string $value)
    {
        if (!preg_match('/^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/i', $value)) {
            throw new InvalidArgumentException("Invalid UK postcode: {$value}");
        }
    }

    public function outcode(): string
    {
        return explode(' ', $this->value)[0];
    }

    public function area(): string
    {
        return preg_replace('/[0-9].*$/', '', $this->outcode());
    }
}
```

---

### Non-Bloat Coding
Every line of code earns its place. No unused imports, no dead code, no speculative generics, no "we might need this later" abstractions. If it's not solving a current, known problem, it doesn't go in.

```php
// Failed:  Bloat - unused import, unused variable, unused method
use App\Models\Tenant\CarinaMessage; // never used

class ChatService
{
    private $unusedProperty;

    public function send(string $message): void
    {
        $temp = $this->format($message); // intermediate variable used once
        // inline it instead
    }

    private function neverCalled(): void {} // dead code
}

// Done:  Lean - only what's needed
use App\Models\Tenant\CarinaConversation;

class ChatService
{
    public function send(string $message): void
    {
        $this->format($message);
    }
}
```

**Rules:**
- No unused imports. Configure your IDE to remove them on save.
- No dead code. If it's not called, delete it.
- No speculative abstractions. Build the interface when you have a second implementation, not before.
- No "future-proofing" that adds complexity today for a problem that may never come.
- If a feature is deferred, delete the half-finished code. Git has the history.

---

### Non-Spaghetti Coding
The flow of control is linear and predictable. No callbacks nested five deep, no hidden side effects, no services that depend on ten other services in a web. Each function does one thing, calls the next thing, and returns.

```php
// Failed:  Spaghetti - nested callbacks, hidden side effects, hard to trace
public function process(Request $request): Response
{
    $user = User::find($request->user_id);
    $this->doThing($user);
    // what did doThing change? no idea
    $result = $this->doAnotherThing();
    // where did result come from? unclear
    return response()->json($result);
}

// Done:  Linear - each step is visible, side effects are explicit
public function process(Request $request): Response
{
    $user = $this->findUserOrFail($request->user_id);
    $analysis = $this->analysePortfolio($user);
    $report = $this->generateReport($analysis);

    return response()->json($report);
}
```

**Rules:**
- Services should have at most 3-4 injected dependencies. If it's more, the service is doing too much.
- Avoid `$this->` mutation within methods. If a method changes object state, its name should say so (`markAsPaid()`, not `process()`).
- No nested ternary operators. No assignment inside conditionals (`if ($x = $y->get())`).
- Early returns over deeply nested if/else.
- The happy path should read top-to-bottom. Errors are handled at the end or extracted.

---

### Lean but Does the Job
The simplest solution that works correctly. No over-engineering. No abstract factory visitor observer pattern for a CRUD endpoint. No six layers of indirection between the controller and the database.

```php
// Failed:  Over-engineered for a simple lookup
interface PropertyRepositoryInterface {}
abstract class AbstractPropertyRepository {}
class PostgresPropertyRepository extends AbstractPropertyRepository implements PropertyRepositoryInterface {}
class CacheDecorator extends AbstractPropertyRepository {}
class PropertyController {
    public function __construct(
        private CacheDecorator $repo // three layers for a SELECT query
    ) {}
}

// Done:  Lean - direct and clear
class PropertyController
{
    public function show(int $id): JsonResponse
    {
        $property = Property::findOrFail($id);

        return response()->json($property);
    }
}
```

**Rules:**
- Start simple. Add abstraction when you HAVE a second case, not when you IMAGINE one.
- If Eloquent does what you need, use Eloquent. Don't build a repository layer "just in case."
- If a Blade template does what you need, use Blade. Don't bring in React "just in case."
- Two solutions to the same problem is one too many.

---

### Maintainable Coding
Code that a new developer (or you, six months from now) can read and understand without a three-hour handover. Predictable patterns. Consistent naming. Tests that document behaviour.

```php
// Failed:  Unmaintainable - clever, undocumented, inconsistent
public function calc(User $u, $d): array
{
    $x = $d['purchase_price'] - $d['deposit'];
    $y = $x * ($d['rate'] / 100 / 12);
    $z = $d['rent'] - $y;
    return ['cf' => $z, 'co' => $z * 12 / ($d['deposit'] + $d['costs']) * 100];
}

// Done:  Maintainable - names explain intent, structure reveals logic
public function calculateReturnOnInvestment(DealInput $input): DealResult
{
    $loanAmount = $input->purchasePrice - $input->deposit;
    $monthlyInterest = $this->calculateMonthlyInterest($loanAmount, $input->interestRate);
    $monthlyCashflow = $input->monthlyRent - $monthlyInterest;
    $totalInvestment = $input->deposit + $input->purchaseCosts;
    $annualCashflow = $monthlyCashflow * 12;
    $roi = ($annualCashflow / $totalInvestment) * 100;

    return new DealResult(
        monthlyCashflow: $monthlyCashflow,
        roiPercent: round($roi, 2),
    );
}

private function calculateMonthlyInterest(float $principal, float $annualRate): float
{
    return $principal * ($annualRate / 100 / 12);
}
```

**Rules:**
- Code is read far more often than it is written. Optimise for reading.
- Naming is the most important thing. A good name eliminates the need for a comment.
- Tests are documentation. If a behaviour isn't tested, it might not be intended.
- Follow Laravel conventions (PSR-4, PSR-12, Laravel naming patterns). Consistency over cleverness.

---

### Non-Complex Coding
The simplest possible solution. No clever tricks, no bitwise operations in business logic, no recursive algorithms where a loop works, no reflection unless absolutely necessary.

```php
// Failed:  Overly complex
$names = collect($users)->reduce(function ($carry, $user) {
    return $carry . $user->name . ', ';
}, '');

// Done:  Simple
$names = $users->pluck('name')->implode(', ');
```

**Rules:**
- If a junior developer can't understand it in 30 seconds, it's too complex.
- Prefer flat loops over recursive calls.
- Prefer `match` over long if/else chains.
- Prefer early returns over deep nesting.
- If a method needs a comment to explain what it does, rename it so it doesn't.

---

## Project-Specific Standards

### Naming Convention

| What | Convention | Example |
|---|---|---|
| Classes | PascalCase | `CreateContactTool` |
| Methods | camelCase | `calculateYield()` |
| Variables | camelCase | `$monthlyCashflow` |
| Database tables | snake_case plural | `usage_log`, `subscription_plans` |
| Database columns | snake_case | `api_calls_per_month` |
| Config keys | snake_case | `ai.providers.deepseek.api_key` |
| Routes (Web) | kebab-case | `settings/usage` |
| Routes (API) | camelCase (resources: kebab) | `chat`, `knowledge/search` |
| Enums | PascalCase | `ContactType::Investor` |
| DTOs | PascalCase + Data suffix | `DealInputData`, `ContactData` |
| Exceptions | PascalCase + Exception suffix | `ProviderUnavailableException` |

### File Organisation

```
app/Services/{Domain}/
├── {Service}.php              # Main service class
├── Contracts/
│   └── {Interface}.php        # Interface (only when multiple implementations exist)
├── Data/
│   └── {Entity}Data.php       # DTOs
├── Enums/
│   └── {Entity}Type.php       # Enums
├── Exceptions/
│   └── {Domain}Exception.php  # Domain exceptions
└── Providers/                 # Provider implementations (only when interface pattern is needed)
    └── {Specific}Provider.php
```

### Testing Standards

```php
// Done:  Tests document behaviour
it('rejects invalid UK postcodes', function () {
    expect(fn () => new Postcode('not-a-postcode'))
        ->toThrow(InvalidArgumentException::class, 'Invalid UK postcode');
});

it('extracts outcode from a full postcode', function () {
    $postcode = new Postcode('M1 1AA');
    expect($postcode->outcode())->toBe('M1');
});

// Failed:  Bad test - tests implementation, not behaviour
it('calls the database', function () {
    DB::shouldReceive('select')->once();
    (new Service)->doThing();
});
```

**Rules:**
- Every public method has a test.
- Tests describe behaviour, not implementation.
- One assertion per test (or a logical group of related assertions).
- No mock-heavy tests that break on refactoring. Mock at boundaries only.

### Documentation Standards

- Docblocks only for public APIs and complex logic. Not for obvious getters.
- One `@param` and `@return` per docblock. Type hints say the same thing; don't duplicate.
- Code examples in docblocks where the API is non-obvious.

```php
// Done:  Minimal docblock - types are in the signature
public function calculateYield(float $purchasePrice, float $monthlyRent): float
{
    return ($monthlyRent * 12) / $purchasePrice * 100;
}

// Done:  Full docblock for complex public API
/**
 * Calculate the return on investment for a property deal.
 *
 * Takes into account purchase price, deposit, monthly rent,
 * interest rate, and purchase costs to produce cashflow and ROI figures.
 *
 * @param DealInputData $input All deal parameters
 * @return DealResult Monthly cashflow, annual cashflow, and ROI percentage
 *
 * @throws InvalidDealException If deposit exceeds purchase price
 */
public function calculateROI(DealInputData $input): DealResult
```

---

## The One-Paragraph Summary

> Write code that reads like a sentence. Build data structures once and reuse them everywhere. Every line must earn its place - no dead code, no speculation, no complexity that isn't solving a real problem. Keep the flow linear and predictable. Choose the simplest solution that works correctly. Name things so well that comments become unnecessary. Write tests that document behaviour. If a junior developer can't read your code and understand what it does in 30 seconds, simplify it until they can.
