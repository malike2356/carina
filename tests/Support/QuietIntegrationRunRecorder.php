<?php

declare(strict_types=1);

namespace Tests\Support;

use App\Services\Integrations\Support\IntegrationRunRecorder;

/**
 * Skips persistence for unit tests that do not provision a tenant database.
 */
final class QuietIntegrationRunRecorder extends IntegrationRunRecorder
{
    /**
     * @template T
     *
     * @param  callable(): T  $callback
     * @return T
     */
    public function wrap(string $provider, string $operation, array $requestData, callable $callback): mixed
    {
        return $callback();
    }
}
