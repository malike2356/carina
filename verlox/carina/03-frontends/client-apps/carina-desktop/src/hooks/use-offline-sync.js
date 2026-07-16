import { useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { $gatewayStatus } from '../store/connection.js';
import { isGatewayOnline } from '../lib/gateway-client.js';
import { initOfflineCache, recalcPendingChanges } from '../lib/offline/cache.js';
import { refreshSyncMeta } from '../store/sync.js';
import { runSync, startBackgroundSync } from '../lib/offline/sync-service.js';
export function useOfflineSync() {
    const gatewayStatus = useStore($gatewayStatus);
    useEffect(() => {
        void initOfflineCache().then(() => {
            recalcPendingChanges();
            refreshSyncMeta();
        });
    }, []);
    useEffect(() => {
        const stop = startBackgroundSync(() => isGatewayOnline($gatewayStatus.get()));
        return stop;
    }, []);
    useEffect(() => {
        if (isGatewayOnline(gatewayStatus)) {
            void runSync(true);
        }
        else {
            recalcPendingChanges();
            refreshSyncMeta();
        }
    }, [gatewayStatus]);
    return {
        syncNow: async () => runSync(isGatewayOnline($gatewayStatus.get())),
    };
}
