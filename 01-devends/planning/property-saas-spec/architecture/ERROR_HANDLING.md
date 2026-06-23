# Carina AI - Error Handling Strategy

**Principle:** Every error is caught, logged, and returned as a structured, user-friendly response.  
**Never expose:** stack traces, file paths, SQL queries, internal IPs, or API keys.

---

## Global Error Response Format

```json
{
    "error": {
        "code": "ERROR_CODE",
        "message": "Human-readable message for this user.",
        "details": {},
        "request_id": "req_abc123",
        "docs_url": "https://docs.carina.verlox.uk/errors/ERROR_CODE"
    }
}
```

## Error Codes & User Messages

### Auth Errors (401, 403)

| Code | HTTP | User Message |
|---|---|---|
| `UNAUTHENTICATED` | 401 | "Please log in to continue." |
| `INVALID_API_KEY` | 401 | "Invalid API key. Check your Authorization header." |
| `EXPIRED_API_KEY` | 401 | "This API key expired on [date]. Generate a new one in Settings." |
| `RATE_LIMITED` | 429 | "Too many requests. Try again in [X] seconds." |
| `ACCOUNT_SUSPENDED` | 403 | "Your account has been suspended. Contact support at support@verlox.uk." |
| `INSUFFICIENT_PERMISSIONS` | 403 | "Your API key does not have permission for this action." |

### Billing Errors (402)

| Code | HTTP | User Message |
|---|---|---|
| `TOKEN_LIMIT_EXCEEDED` | 402 | "You've used all [X] tokens this month. Upgrade or buy a top-up to continue." |
| `API_CALL_LIMIT_EXCEEDED` | 402 | "You've used all [X] API calls this month. Upgrade your plan." |
| `PAYMENT_FAILED` | 402 | "Your last payment failed. Update your billing information to continue." |
| `PLAN_DOES_NOT_ALLOW` | 402 | "This feature requires [Pro+ or higher]. Upgrade to use it." |

### Validation Errors (422)

| Code | HTTP | User Message |
|---|---|---|
| `VALIDATION_ERROR` | 422 | "Check your input: [field] [validation message]." |
| `FILE_TOO_LARGE` | 413 | "File exceeds the [X] MB limit." |
| `UNSUPPORTED_FILE_TYPE` | 422 | "Unsupported file type. Supported: [list of types]." |
| `INVALID_POSTCODE` | 422 | "Invalid UK postcode format. Example: M1 1AA." |
| `MESSAGE_TOO_LONG` | 422 | "Message exceeds the 8,000 character limit." |

### Provider Errors (503)

| Code | HTTP | User Message |
|---|---|---|
| `AI_PROVIDER_UNAVAILABLE` | 503 | "I'm having trouble connecting. Your request has been queued." |
| `DATA_PROVIDER_UNAVAILABLE` | 200 | "Live data temporarily unavailable. Showing data from [date]." |
| `ALL_PROVIDERS_FAILED` | 503 | "All AI providers are currently unavailable. We're working on it." |
| `PROVIDER_RATE_LIMITED` | 429 | "AI provider is rate-limited. Retrying in [X] seconds." |

### System Errors (500)

| Code | HTTP | User Message |
|---|---|---|
| `INTERNAL_ERROR` | 500 | "Something went wrong. We've been notified. Req: [req_id]" |
| `SERVICE_UNAVAILABLE` | 503 | "Carina is temporarily unavailable. We'll be back shortly." |
| `MAINTENANCE_MODE` | 503 | "Carina is undergoing maintenance. Estimated completion: [time]." |

---

## Error Handling Middleware

```php
// app/Http/Middleware/HandleApiErrors.php

class HandleApiErrors
{
    public function handle(Request $request, Closure $next): Response
    {
        try {
            $response = $next($request);

            // Catch 4xx/5xx from valid responses
            if ($response->isServerError() || $response->isClientError()) {
                return $this->formatError($response, $request);
            }

            return $response;
        } catch (AuthenticationException $e) {
            return $this->json(['code' => 'UNAUTHENTICATED', 'message' => 'Please log in.'], 401);
        } catch (AuthorizationException $e) {
            return $this->json(['code' => 'INSUFFICIENT_PERMISSIONS', 'message' => $e->getMessage()], 403);
        } catch (ValidationException $e) {
            return $this->validationError($e);
        } catch (ThrottleRequestsException $e) {
            return $this->json(['code' => 'RATE_LIMITED', 'message' => 'Too many requests.'], 429);
        } catch (ModelNotFoundException $e) {
            return $this->json(['code' => 'NOT_FOUND', 'message' => 'Resource not found.'], 404);
        } catch (ProviderException $e) {
            return $this->providerError($e);
        } catch (BillingException $e) {
            return $this->billingError($e);
        } catch (Throwable $e) {
            Log::error('Unhandled exception', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'request_id' => request()->header('X-Request-Id'),
            ]);
            return $this->json(['code' => 'INTERNAL_ERROR', 'message' => 'Something went wrong.'], 500);
        }
    }
}
```

---

## Logging Errors

Every error is logged with:

```php
Log::error('Provider unavailable', [
    'provider' => $provider,
    'error' => $e->getMessage(),
    'tenant_id' => tenant('id'),
    'user_id' => auth()->id(),
    'request_id' => request()->header('X-Request-Id'),
    'duration_ms' => $duration,
]);
```

All errors also reported to Sentry for real-time alerting.

---

## Error UI (Web)

Inline error: Red banner below the input. No page reload.
```
┌─────────────────────────────────────┐
│  WARNING:   You've used all 5,000 free tokens. Upgrade to continue chatting.
│  [Upgrade to Pro] [Buy top-up]  [Dismiss]
└─────────────────────────────────────┘
```

API error: Structured JSON only. No HTML error pages.

---

## Files

```
app/Exceptions/
├── Handler.php                    # Global exception handler
├── ProviderException.php          # AI/data provider failures
├── BillingException.php           # Token/plan/payment errors
└── ValidationException.php        # Extended validation

app/Http/Middleware/
└── HandleApiErrors.php            # API error formatter

resources/views/errors/            # Custom error pages (web UI)
├── 401.blade.php
├── 402.blade.php
├── 403.blade.php
├── 404.blade.php
├── 419.blade.php
├── 429.blade.php
└── 500.blade.php
```
