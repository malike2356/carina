/**
 * Carina runtime wiring for public/private error handling.
 */
import {
  detectFiveHundredSpike,
  globalUncaughtHandler,
  onErrorLogged,
  type PrivateErrorEntry,
  type SpikeAlert,
} from './index.js';

let installed = false;

export function installCarinaErrorHandling(options?: {
  onSpike?: (spike: SpikeAlert, entry: PrivateErrorEntry) => void;
}): () => void {
  globalUncaughtHandler();
  if (installed) {
    return () => undefined;
  }
  installed = true;
  const unsubscribe = onErrorLogged((entry, spike) => {
    if (spike.triggered) {
      console.error('[error-spike]', spike.message, {
        reference: entry.errorReference,
        route: entry.route,
        statusCode: entry.statusCode,
      });
      options?.onSpike?.(spike, entry);
    }
  });
  return () => {
    unsubscribe();
    installed = false;
  };
}

export function currentFiveHundredSpike(): SpikeAlert {
  return detectFiveHundredSpike();
}

export {
  createPublicError,
  errorBoundary,
  expressErrorMiddleware,
  getErrorContext,
  getPublicMessage,
  jobErrorBoundary,
  logError,
  paymentErrorBoundary,
  searchErrors,
  sendPublicError,
  webhookErrorBoundary,
} from './index.js';
