<?php

declare(strict_types=1);

namespace Tests\Concerns;

use App\Support\TestingCentralCatalog;
use Illuminate\Support\Facades\DB;

trait BypassesRlsForTests
{
    protected function bypassRls(?string $tenantId = null): void
    {
        foreach ($this->centralConnectionsForRls() as $connection) {
            DB::connection($connection)->statement(
                "SELECT set_config('app.current_tenant_id', ?, false)",
                [$tenantId ?? '']
            );
        }
    }

    /**
     * @return list<string>
     */
    private function centralConnectionsForRls(): array
    {
        $connections = ['central'];

        $metadata = TestingCentralCatalog::tenantMetadataConnectionInTests();
        if ($metadata !== null) {
            $connections[] = $metadata;
        }

        return array_values(array_unique($connections));
    }
}
